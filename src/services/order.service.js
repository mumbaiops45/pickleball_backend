import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import Address from "../models/address.model.js";
import Payment from "../models/payment.model.js";
import { sellingPrice } from "../utils/pricing.js";
import { getShippingCharge } from "../config/store.js";
import {
    getRazorpayInstance,
    toSmallestUnit
} from "../config/razorpay.js";
import {
    ORDER_STATUSES,
    applyOrderStatus
} from "../utils/orderStatus.js";
import {
    autoShipOrder,
    cancelShipmentService,
    syncTrackingService
} from "./shipping.service.js";

const httpError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const generateOrderNumber = () => {
    const timestamp = Date.now();

    const random = Math.floor(
        1000 + Math.random() * 9000
    );

    return `PB-${timestamp}-${random}`;
};

const releaseStock = (items) =>
    Promise.all(
        items.map((item) =>
            Product.findByIdAndUpdate(item.product, {
                $inc: {
                    stock: item.quantity
                }
            })
        )
    );

/**
 * Takes stock for every line or for none: a line that runs out part
 * way through puts back what the earlier lines took.
 */
const reserveStock = async (items) => {
    const taken = [];

    for (const item of items) {
        const updated = await Product.findOneAndUpdate(
            {
                _id: item.product,
                stock: {
                    $gte: item.quantity
                }
            },
            {
                $inc: {
                    stock: -item.quantity
                }
            }
        );

        if (!updated) {
            await releaseStock(taken);
            throw new Error(`Insufficient stock for ${item.name}`);
        }

        taken.push(item);
    }
};

export const createOrderService = async ({
    userId,
    addressId,
    paymentMethod
}) => {
    if (!addressId) {
        throw new Error("Address is required");
    }

    if (!paymentMethod) {
        throw new Error("Payment method is required");
    }

    if (!["COD", "ONLINE"].includes(paymentMethod)) {
        throw new Error("Invalid payment method");
    }

    const cart = await Cart.findOne({
        user: userId
    }).populate("items.product");

    if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty");
    }

    const address = await Address.findOne({
        _id: addressId,
        user: userId
    });

    if (!address) {
        throw new Error("Address not found");
    }

    const orderItems = [];

    let subtotal = 0;

    for (const cartItem of cart.items) {
        // populate leaves null behind for a product deleted since
        const product = cartItem.product;

        if (!product) {
            throw new Error(
                "An item in your cart is no longer available"
            );
        }

        if (!product.isActive) {
            throw new Error(
                `${product.name} is no longer available`
            );
        }

        if (product.stock < cartItem.quantity) {
            throw new Error(
                `Insufficient stock for ${product.name}`
            );
        }

        // always the live price, never the one cached on the cart line
        const price = sellingPrice(product);

        const itemTotal =
            price * cartItem.quantity;

        subtotal += itemTotal;

        orderItems.push({
            product: product._id,
            name: product.name,
            image: product.images?.[0] || null,
            quantity: cartItem.quantity,
            price,
            total: itemTotal
        });
    }

    const shippingCharge = getShippingCharge(subtotal);

    const discount = 0;

    const totalAmount =
        subtotal +
        shippingCharge -
        discount;

    // Online orders take stock when the payment is captured
    // (payment.service settlePayment); COD takes it now.
    if (paymentMethod === "COD") {
        await reserveStock(orderItems);
    }

    const initialStatus =
        paymentMethod === "COD" ? "CONFIRMED" : "PENDING";

    let order;

    try {
        order = await Order.create({
            orderNumber: generateOrderNumber(),

            user: userId,

            items: orderItems,

            shippingAddress: {
                fullName: address.fullName,
                phone: address.phone,
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
                country: address.country
            },

            subtotal,

            shippingCharge,

            discount,

            totalAmount,

            paymentMethod,

            paymentStatus: "PENDING",

            orderStatus: initialStatus,

            statusHistory: [
                {
                    status: initialStatus,
                    note:
                        paymentMethod === "COD"
                            ? "Order placed, cash on delivery"
                            : "Order placed, awaiting payment"
                }
            ]
        });
    } catch (error) {
        if (paymentMethod === "COD") {
            await releaseStock(orderItems);
        }

        throw error;
    }

    // The order now holds its own copy of the lines. Emptying the cart
    // here (rather than after payment) means a retried payment later
    // cannot wipe a new cart the customer has started since.
    cart.items = [];
    cart.subtotal = 0;

    await cart.save();

    if (paymentMethod === "COD") {
        autoShipOrder(order._id);
    }

    return order;
};

export const getMyOrdersService = async (userId) => {
    const orders = await Order.find({
        user: userId
    })
        .populate(
            "items.product",
            "name images slug"
        )
        .sort({
            createdAt: -1
        });

    return orders;
};

export const getOrderByIdService = async (
    userId,
    orderId
) => {
    const order = await Order.findOne({
        _id: orderId,
        user: userId
    }).populate(
        "items.product",
        "name images slug"
    );

    if (!order) {
        throw new Error("Order not found");
    }

    // pulls fresh courier scans, throttled inside
    return syncTrackingService(order);
};

/**
 * Starts a Razorpay refund for a paid online order. A refund that
 * cannot be started does not block the cancellation: the order is
 * noted as awaiting a manual refund instead.
 */
const refundOrder = async (order) => {
    if (
        order.paymentMethod !== "ONLINE" ||
        order.paymentStatus !== "PAID" ||
        !order.paymentId
    ) {
        return null;
    }

    try {
        await getRazorpayInstance().payments.refund(order.paymentId, {
            amount: toSmallestUnit(order.totalAmount),
            notes: {
                orderNumber: order.orderNumber
            }
        });

        order.paymentStatus = "REFUNDED";

        await Payment.findOneAndUpdate(
            { order: order._id },
            { status: "REFUNDED" }
        );

        return "Refund started to the original payment method";
    } catch (error) {
        // the Razorpay SDK rejects with { statusCode, error: { description } }
        const reason =
            error?.error?.description ||
            error?.message ||
            "payment gateway error";

        console.error(
            `Refund failed for ${order.orderNumber}:`,
            reason
        );

        return `Refund pending (${reason}). Our team will process it manually`;
    }
};

export const cancelOrderService = async ({
    userId,
    orderId,
    reason,
    byAdmin = false
}) => {
    const order = await Order.findOne(
        byAdmin
            ? { _id: orderId }
            : { _id: orderId, user: userId }
    );

    if (!order) {
        throw new Error("Order not found");
    }

    if (
        ["SHIPPED", "DELIVERED", "CANCELLED"]
            .includes(order.orderStatus)
    ) {
        throw new Error(
            "Order cannot be cancelled"
        );
    }

    // stop the parcel first: if the courier refuses, nothing has changed
    try {
        await cancelShipmentService(order);
    } catch (error) {
        throw httpError(
            `Order cannot be cancelled: the shipment could not be stopped (${error.message})`,
            409
        );
    }

    // Stock was only ever taken for COD orders and for paid online ones.
    const stockTaken =
        order.paymentMethod === "COD" ||
        order.paymentStatus === "PAID" ||
        order.paymentStatus === "REFUNDED";

    const refundNote = await refundOrder(order);

    order.cancelledAt = new Date();
    order.cancellationReason =
        reason ||
        (byAdmin ? "Cancelled by store" : "Cancelled by customer");

    applyOrderStatus(
        order,
        "CANCELLED",
        [order.cancellationReason, refundNote].filter(Boolean).join(". ")
    );

    if (stockTaken) {
        await releaseStock(order.items);
    }

    await order.save();

    return order;
};

/**
 * Admin: move an order along by hand, optionally with courier details
 * for a parcel not sent through Shiprocket.
 */
export const updateOrderStatusService = async ({
    orderId,
    orderStatus,
    note,
    courierName,
    awbCode,
    trackingUrl
}) => {
    const status = String(orderStatus || "").toUpperCase();

    if (!ORDER_STATUSES.includes(status)) {
        throw new Error(
            `Invalid order status. Use one of ${ORDER_STATUSES.join(", ")}`
        );
    }

    if (status === "CANCELLED") {
        return cancelOrderService({
            orderId,
            reason: note,
            byAdmin: true
        });
    }

    const order = await Order.findById(orderId);

    if (!order) {
        throw new Error("Order not found");
    }

    if (["CANCELLED", "DELIVERED"].includes(order.orderStatus)) {
        throw new Error(
            `A ${order.orderStatus.toLowerCase()} order cannot be changed`
        );
    }

    if (
        order.paymentMethod === "ONLINE" &&
        order.paymentStatus !== "PAID" &&
        status !== "PENDING"
    ) {
        throw new Error(
            "Order cannot be moved on before it is paid"
        );
    }

    if (awbCode) {
        order.shipment.provider ||= "MANUAL";
        order.shipment.awbCode = String(awbCode).trim();
    }

    if (courierName) {
        order.shipment.courierName = String(courierName).trim();
    }

    if (trackingUrl) {
        order.shipment.trackingUrl = String(trackingUrl).trim();
    }

    applyOrderStatus(order, status, note || "Updated by store");

    await order.save();

    return order;
};
