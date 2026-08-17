import {
    createOrderService,
    getMyOrdersService,
    getOrderByIdService,
    cancelOrderService
} from "../services/order.service.js";

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
            reason
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