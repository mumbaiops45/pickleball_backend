import {
    createPaymentService,
    completePaymentService,
    failPaymentService
} from "../services/payment.service.js";

export const createPayment = async (req, res, next) => {
    try {
        const { orderId } = req.body;

        const payment = await createPaymentService({
            userId: req.user._id,
            orderId
        });

        res.status(201).json({
            success: true,
            message: "Payment created successfully",
            data: payment
        });
    } catch (error) {
        next(error);
    }
};

export const completePayment = async (req, res, next) => {
    try {
        const {
            paymentId,
            transactionId
        } = req.body;

        const result =
            await completePaymentService({
                userId: req.user._id,
                paymentId,
                transactionId
            });

        res.status(200).json({
            success: true,
            message: "Payment completed successfully",
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const failPayment = async (req, res, next) => {
    try {
        const {
            paymentId,
            failureReason
        } = req.body;

        const payment =
            await failPaymentService({
                userId: req.user._id,
                paymentId,
                failureReason
            });

        res.status(200).json({
            success: true,
            message: "Payment marked as failed",
            data: payment
        });
    } catch (error) {
        next(error);
    }
};