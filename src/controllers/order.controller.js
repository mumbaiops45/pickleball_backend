import {
    createOrderService,
    getMyOrdersService,
    getOrderByIdService,
    cancelOrderService,
    updateOrderStatusService
} from "../services/order.service.js";
import Order from "../models/order.model.js";
import {
    shipOrderService,
    syncTrackingService
} from "../services/shipping.service.js";

export const createOrder = async (req, res, next) => {
    try {
        const {
            addressId,
            paymentMethod
        } = req.body;

        const order = await createOrderService({
            userId: req.user._id,
            addressId,
            paymentMethod
        });

        res.status(201).json({
            success: true,
            message: "Order created successfully",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

export const getMyOrders = async (req, res, next) => {
    try {
        const orders = await getMyOrdersService(
            req.user._id
        );

        res.status(200).json({
            success: true,
            data: orders
        });
    } catch (error) {
        next(error);
    }
};

export const getOrderById = async (req, res, next) => {
    try {
        const order = await getOrderByIdService(
            req.user._id,
            req.params.id
        );

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

export const cancelOrder = async (req, res, next) => {
    try {
        const { reason } = req.body;

        const order = await cancelOrderService({
            userId: req.user._id,
            orderId: req.params.id,
            reason,
            // the admin panel cancels other people's orders through this route
            byAdmin: req.user.role === "ADMIN"
        });

        res.status(200).json({
            success: true,
            message: "Order cancelled successfully",
            data: order
        });
    } catch (error) {
        next(error);
    }
};
/* ------------------------------------------------------------ admin */

export const updateOrderStatus = async (req, res, next) => {
    try {
        const {
            orderStatus,
            status,
            note,
            courierName,
            awbCode,
            trackingUrl
        } = req.body;

        const order = await updateOrderStatusService({
            orderId: req.params.id,
            orderStatus: orderStatus || status,
            note,
            courierName,
            awbCode,
            trackingUrl
        });

        res.status(200).json({
            success: true,
            message: "Order status updated",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

export const shipOrder = async (req, res, next) => {
    try {
        const order = await shipOrderService(req.params.id, {
            courierId: req.body?.courierId
        });

        res.status(200).json({
            success: true,
            message: order.shipment.lastError
                ? `Shipment created. ${order.shipment.lastError}`
                : "Shipment created and pickup requested",
            data: order
        });
    } catch (error) {
        next(error);
    }
};

export const syncOrderTracking = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            throw new Error("Order not found");
        }

        await syncTrackingService(order, { force: true });

        res.status(200).json({
            success: true,
            message: order.shipment.lastError || "Tracking refreshed",
            data: order
        });
    } catch (error) {
        next(error);
    }
};
