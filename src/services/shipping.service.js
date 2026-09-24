import crypto from "crypto";
import Order from "../models/order.model.js";
import {
    isShiprocketConfigured,
    isAutoShipEnabled,
    createShiprocketOrder,
    assignAwb,
    generatePickup,
    trackAwb,
    cancelShiprocketOrder,
    publicTrackingUrl
} from "../config/shiprocket.js";
import {
    applyOrderStatus,
    isForward,
    statusFromCourier
} from "../utils/orderStatus.js";

// Shiprocket's tracking API is rate limited; a customer refreshing the
// order page should not hit it every time.
const TRACKING_TTL_MS = 30 * 60 * 1000;

const httpError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// "2026-09-20 10:15:00" -> Date, or null
const toDate = (value) => {
    if (!value) {
        return null;
    }

    const date = new Date(String(value).replace(" ", "T"));

    return Number.isNaN(date.getTime()) ? null : date;
};

const toEvents = (scans = []) =>
    scans
        .map((scan) => ({
            status:
                scan["sr-status-label"] ||
                scan.status ||
                scan["sr-status"] ||
                "",
            activity: scan.activity || "",
            location: scan.location || "",
            at: toDate(scan.date)
        }))
        .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));

/**
 * Folds one courier update into the order: the scans, the courier's
 * own status line and, when it moves the parcel forward, orderStatus.
 * A cancelled order is left alone.
 */
const applyCourierUpdate = (order, {
    currentStatus,
    events,
    estimatedDelivery,
    courierName,
    awbCode
}) => {
    const shipment = order.shipment;

    if (currentStatus) shipment.currentStatus = currentStatus;
    if (events?.length) shipment.events = events;
    if (estimatedDelivery) shipment.estimatedDelivery = estimatedDelivery;
    if (courierName && !shipment.courierName) shipment.courierName = courierName;
    if (awbCode && !shipment.awbCode) {
        shipment.awbCode = awbCode;
        shipment.trackingUrl ||= publicTrackingUrl(awbCode);
    }

    shipment.lastSyncedAt = new Date();
    shipment.lastError = null;

    if (order.orderStatus === "CANCELLED") {
        return;
    }

    const next = statusFromCourier(currentStatus);

    if (next && isForward(order.orderStatus, next)) {
        applyOrderStatus(order, next, currentStatus);
    }
};

/**
 * Pushes a confirmed order to Shiprocket: creates the order there,
 * assigns an AWB and books the pickup. Each step is skipped when a
 * previous run already did it, so a failed attempt can be retried.
 */
export const shipOrderService = async (orderId, { courierId } = {}) => {
    if (!isShiprocketConfigured()) {
        throw httpError(
            "Shiprocket is not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD",
            503
        );
    }

    const order = await Order.findById(orderId).populate("user", "email");

    if (!order) {
        throw new Error("Order not found");
    }

    if (["CANCELLED", "SHIPPED", "DELIVERED"].includes(order.orderStatus)) {
        throw httpError(`A ${order.orderStatus.toLowerCase()} order cannot be shipped`, 400);
    }

    if (order.paymentMethod === "ONLINE" && order.paymentStatus !== "PAID") {
        throw httpError("This order has not been paid for yet", 400);
    }

    const shipment = order.shipment;
    shipment.provider = "SHIPROCKET";

    try {
        if (!shipment.shipmentId) {
            const created = await createShiprocketOrder(order);

            shipment.shiprocketOrderId = String(created.order_id);
            shipment.shipmentId = String(created.shipment_id);

            if (created.awb_code) {
                shipment.awbCode = String(created.awb_code);
                shipment.courierName = created.courier_name || null;
            }
        }

        if (!shipment.awbCode) {
            const awb = await assignAwb(shipment.shipmentId, courierId);

            shipment.awbCode = awb.awbCode;
            shipment.courierName = awb.courierName;
        }

        shipment.trackingUrl = publicTrackingUrl(shipment.awbCode);
        shipment.lastError = null;

        applyOrderStatus(
            order,
            "PROCESSING",
            shipment.courierName
                ? `Packed. Courier: ${shipment.courierName}, AWB ${shipment.awbCode}`
                : `Packed. AWB ${shipment.awbCode}`
        );
    } catch (error) {
        // keep whatever was created so the retry resumes from there
        shipment.lastError = error.message;
        await order.save();
        throw error;
    }

    await order.save();

    // A pickup that fails to book is not fatal: the AWB exists and the
    // pickup can be requested from the Shiprocket panel.
    try {
        await generatePickup(shipment.shipmentId);
    } catch (error) {
        shipment.lastError = `Pickup not booked: ${error.message}`;
        await order.save();
    }

    return order;
};

/**
 * Called once an order is confirmed (COD placed, or online payment
 * captured). Never throws: a Shiprocket outage must not fail checkout.
 */
export const autoShipOrder = (orderId) => {
    if (!isAutoShipEnabled()) {
        return;
    }

    shipOrderService(orderId).catch((error) => {
        console.error(`Auto-ship failed for order ${orderId}:`, error.message);
    });
};

/**
 * Refreshes courier scans for an order, at most every 30 minutes.
 * Failures are recorded, not thrown: the stored timeline still shows.
 */
export const syncTrackingService = async (order, { force = false } = {}) => {
    const shipment = order.shipment;

    if (
        !shipment?.awbCode ||
        shipment.provider !== "SHIPROCKET" ||
        !isShiprocketConfigured() ||
        ["CANCELLED", "DELIVERED"].includes(order.orderStatus)
    ) {
        return order;
    }

    const fresh =
        shipment.lastSyncedAt &&
        Date.now() - shipment.lastSyncedAt.getTime() < TRACKING_TTL_MS;

    if (fresh && !force) {
        return order;
    }

    try {
        const body = await trackAwb(shipment.awbCode);
        // single-AWB lookups answer { tracking_data }, bulk ones key it by AWB
        const data =
            body?.tracking_data ??
            body?.[shipment.awbCode]?.tracking_data ??
            {};

        const track = data.shipment_track?.[0] ?? {};

        applyCourierUpdate(order, {
            currentStatus: track.current_status,
            events: toEvents(data.shipment_track_activities),
            estimatedDelivery: toDate(track.edd || data.etd),
            courierName: track.courier_name
        });

        if (data.track_url) {
            shipment.trackingUrl = data.track_url;
        }
    } catch (error) {
        shipment.lastSyncedAt = new Date();
        shipment.lastError = error.message;
    }

    await order.save();

    return order;
};

/** Stops the parcel before an order is cancelled. */
export const cancelShipmentService = async (order) => {
    const shipment = order.shipment;

    if (
        shipment?.provider !== "SHIPROCKET" ||
        !shipment.shiprocketOrderId ||
        !isShiprocketConfigured()
    ) {
        return;
    }

    await cancelShiprocketOrder(shipment.shiprocketOrderId);
    shipment.currentStatus = "CANCELED";
};

const sameSecret = (expected, received) => {
    if (typeof received !== "string" || expected.length !== received.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
};

/**
 * Shiprocket status webhook (Settings -> API -> Webhooks). Shiprocket
 * sends the token configured there in the `x-api-key` header.
 */
export const handleShiprocketWebhookService = async ({ token, body }) => {
    const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN;

    if (!expected) {
        throw httpError("Shiprocket webhook is not configured", 503);
    }

    if (!sameSecret(expected, token)) {
        throw httpError("Invalid webhook token", 401);
    }

    const awb = body?.awb ? String(body.awb) : null;
    const orderNumber = body?.order_id ? String(body.order_id) : null;

    if (!awb && !orderNumber) {
        return { handled: false };
    }

    const order = await Order.findOne(
        awb
            ? { $or: [{ "shipment.awbCode": awb }, ...(orderNumber ? [{ orderNumber }] : [])] }
            : { orderNumber }
    );

    // return shipments carry their own AWB; an unknown one is not ours
    if (!order || body?.is_return) {
        return { handled: false };
    }

    order.shipment.provider ||= "SHIPROCKET";

    applyCourierUpdate(order, {
        currentStatus: body.current_status || body.shipment_status,
        events: toEvents(body.scans),
        estimatedDelivery: toDate(body.etd),
        courierName: body.courier_name,
        awbCode: awb
    });

    await order.save();

    return { handled: true, orderStatus: order.orderStatus };
};
