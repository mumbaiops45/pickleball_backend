import Payment from "../models/payment.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import { applyOrderStatus } from "../utils/orderStatus.js";
import { autoShipOrder } from "./shipping.service.js";
import {
    getRazorpayInstance,
    getRazorpayKeyId,
    verifyCheckoutSignature,
    verifyWebhookSignature,
    toSmallestUnit
} from "../config/razorpay.js";

const buildCheckoutPayload = ({
    order,
    payment
}) => ({
    key: getRazorpayKeyId(),
    razorpayOrderId: payment.gatewayOrderId,
    amount: toSmallestUnit(payment.amount),
    currency: payment.currency,
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerName: order.shippingAddress.fullName,
    customerPhone: order.shippingAddress.phone
});

/**
 * Moves a captured payment to SUCCESS exactly once.
 *
 * The checkout callback and the Razorpay webhook can both
 * land for the same payment, so the PENDING -> SUCCESS flip
 * is an atomic conditional update: only the winner touches
 * stock, the order and the cart.
 */
const settlePayment = async ({
    payment,
    gatewayPaymentId
}) => {
    const settled = await Payment.findOneAndUpdate(
        {
            _id: payment._id,
            status: {
                $ne: "SUCCESS"
            }
        },
        {
            status: "SUCCESS",
            transactionId: gatewayPaymentId,
            gatewayPaymentId,
            failureReason: null
        },
        {
            new: true
        }
    );

    const order = await Order.findById(payment.order);

    if (!settled) {
        // Already settled by the other channel.
        return {
            payment: await Payment.findById(payment._id),
            order
        };
    }

    if (!order) {
        throw new Error("Order not found");
    }

    for (const item of order.items) {
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
            // The money is already captured, so the order still
            // stands; the shortage is handled manually.
            console.warn(
                `Stock shortage on ${order.orderNumber} for item ${item.name}`
            );
        }
    }

    order.paymentStatus = "PAID";
    order.paymentId = gatewayPaymentId;
    applyOrderStatus(order, "CONFIRMED", "Payment received");

    await order.save();

    // The cart was emptied when the order was placed, so it is not
    // touched here: the customer may have started a new one since.
    autoShipOrder(order._id);

    return {
        payment: settled,
        order
    };
};

export const createPaymentService = async ({
    userId,
    orderId
}) => {
    const order = await Order.findOne({
        _id: orderId,
        user: userId
    });

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.paymentMethod !== "ONLINE") {
        throw new Error(
            "Online payment is not required for this order"
        );
    }

    if (order.paymentStatus === "PAID") {
        throw new Error("Order is already paid");
    }

    if (order.orderStatus === "CANCELLED") {
        throw new Error(
            "Cancelled order cannot be paid"
        );
    }

    const existingPayment = await Payment.findOne({
        order: order._id
    });

    // A pending attempt still holds a usable Razorpay order,
    // so reuse it instead of stacking gateway orders.
    if (
        existingPayment &&
        existingPayment.status === "PENDING" &&
        existingPayment.gatewayOrderId &&
        existingPayment.amount === order.totalAmount
    ) {
        return {
            payment: existingPayment,
            checkout: buildCheckoutPayload({
                order,
                payment: existingPayment
            })
        };
    }

    const razorpay = getRazorpayInstance();

    const gatewayOrder = await razorpay.orders.create({
        amount: toSmallestUnit(order.totalAmount),
        currency: "INR",
        receipt: order.orderNumber,
        notes: {
            orderId: order._id.toString(),
            userId: userId.toString()
        }
    });

    const payment = await Payment.findOneAndUpdate(
        {
            order: order._id
        },
        {
            order: order._id,
            user: userId,
            amount: order.totalAmount,
            currency: "INR",
            method: "ONLINE",
            status: "PENDING",
            gatewayOrderId: gatewayOrder.id,
            gatewayPaymentId: null,
            transactionId: null,
            failureReason: null
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return {
        payment,
        checkout: buildCheckoutPayload({
            order,
            payment
        })
    };
};

export const verifyPaymentService = async ({
    userId,
    razorpayOrderId,
    razorpayPaymentId,
    signature
}) => {
    if (
        !razorpayOrderId ||
        !razorpayPaymentId ||
        !signature
    ) {
        throw new Error(
            "razorpayOrderId, razorpayPaymentId and signature are required"
        );
    }

    const isValid = verifyCheckoutSignature({
        razorpayOrderId,
        razorpayPaymentId,
        signature
    });

    if (!isValid) {
        throw new Error("Invalid payment signature");
    }

    const payment = await Payment.findOne({
        gatewayOrderId: razorpayOrderId,
        user: userId
    });

    if (!payment) {
        throw new Error("Payment not found");
    }

    return settlePayment({
        payment,
        gatewayPaymentId: razorpayPaymentId
    });
};

export const failPaymentService = async ({
    userId,
    razorpayOrderId,
    paymentId,
    failureReason
}) => {
    if (!razorpayOrderId && !paymentId) {
        throw new Error(
            "razorpayOrderId or paymentId is required"
        );
    }

    const query = razorpayOrderId
        ? {
            gatewayOrderId: razorpayOrderId,
            user: userId
        }
        : {
            _id: paymentId,
            user: userId
        };

    const payment = await Payment.findOne(query);

    if (!payment) {
        throw new Error("Payment not found");
    }

    if (payment.status === "SUCCESS") {
        throw new Error("Payment already completed");
    }

    payment.status = "FAILED";
    payment.failureReason =
        failureReason || "Payment failed";

    await payment.save();

    await Order.findByIdAndUpdate(
        payment.order,
        {
            paymentStatus: "FAILED"
        }
    );

    return payment;
};

export const getPaymentByOrderService = async ({
    userId,
    orderId
}) => {
    const payment = await Payment.findOne({
        order: orderId,
        user: userId
    });

    if (!payment) {
        throw new Error("Payment not found");
    }

    return payment;
};

/**
 * Razorpay retries webhooks until it gets a 2xx, so every
 * branch below has to be safe to run more than once.
 */
export const handleWebhookService = async ({
    rawBody,
    signature
}) => {
    if (!rawBody) {
        throw new Error("Webhook body is missing");
    }

    const isValid = verifyWebhookSignature({
        rawBody,
        signature
    });

    if (!isValid) {
        throw new Error("Invalid webhook signature");
    }

    const event = JSON.parse(rawBody.toString());

    const entity =
        event?.payload?.payment?.entity || null;

    if (!entity) {
        return {
            event: event?.event,
            handled: false
        };
    }

    const payment = await Payment.findOne({
        gatewayOrderId: entity.order_id
    });

    if (!payment) {
        return {
            event: event.event,
            handled: false
        };
    }

    if (
        event.event === "payment.captured" ||
        event.event === "order.paid"
    ) {
        await settlePayment({
            payment,
            gatewayPaymentId: entity.id
        });

        return {
            event: event.event,
            handled: true
        };
    }

    if (event.event === "payment.failed") {
        if (payment.status !== "SUCCESS") {
            payment.status = "FAILED";
            payment.gatewayPaymentId = entity.id;
            payment.failureReason =
                entity.error_description ||
                "Payment failed";

            await payment.save();

            await Order.findByIdAndUpdate(
                payment.order,
                {
                    paymentStatus: "FAILED"
                }
            );
        }

        return {
            event: event.event,
            handled: true
        };
    }

    return {
        event: event.event,
        handled: false
    };
};
