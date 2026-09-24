import {
    createPaymentService,
    verifyPaymentService,
    failPaymentService,
    getPaymentByOrderService,
    handleWebhookService
} from "../services/payment.service.js";

export const createPayment = async (req, res, next) => {
    try {
        const { orderId } = req.body;

        const result = await createPaymentService({
            userId: req.user._id,
            orderId
        });

        res.status(201).json({
            success: true,
            message: "Razorpay order created successfully",
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const verifyPayment = async (req, res, next) => {
    try {
        const {
            razorpay_order_id: bodyOrderId,
            razorpay_payment_id: bodyPaymentId,
            razorpay_signature: bodySignature,
            razorpayOrderId,
            razorpayPaymentId,
            // the names older storefront builds send
            gatewayOrderId,
            gatewayPaymentId,
            signature
        } = req.body;

        const result = await verifyPaymentService({
            userId: req.user._id,
            razorpayOrderId:
                razorpayOrderId || bodyOrderId || gatewayOrderId,
            razorpayPaymentId:
                razorpayPaymentId || bodyPaymentId || gatewayPaymentId,
            signature: signature || bodySignature
        });

        res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const failPayment = async (req, res, next) => {
    try {
        const {
            razorpay_order_id: bodyOrderId,
            razorpayOrderId,
            paymentId,
            failureReason,
            reason
        } = req.body;

        const payment = await failPaymentService({
            userId: req.user._id,
            razorpayOrderId:
                razorpayOrderId || bodyOrderId,
            paymentId,
            failureReason: failureReason || reason
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

export const getPaymentByOrder = async (req, res, next) => {
    try {
        const payment = await getPaymentByOrderService({
            userId: req.user._id,
            orderId: req.params.orderId
        });

        res.status(200).json({
            success: true,
            message: "Payment fetched successfully",
            data: payment
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Razorpay keeps retrying anything that is not a 2xx, so a
 * processing failure is logged and acknowledged rather than
 * handed to the error middleware. A bad signature is the one
 * case that must fail loudly.
 */
export const razorpayWebhook = async (req, res) => {
    try {
        const result = await handleWebhookService({
            rawBody: req.rawBody || req.body,
            signature: req.headers["x-razorpay-signature"]
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        if (
            error.message === "Invalid webhook signature" ||
            error.message === "Webhook body is missing"
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error("Razorpay webhook error:", error);

        return res.status(200).json({
            success: true,
            handled: false
        });
    }
};
