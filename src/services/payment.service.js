import Payment from "../models/payment.model.js";
import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";

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

    const existingPayment = await Payment.findOne({
        order: order._id
    });

    if (existingPayment) {
        return existingPayment;
    }

    const payment = await Payment.create({
        order: order._id,
        user: userId,
        amount: order.totalAmount,
        currency: "INR",
        method: "ONLINE",
        status: "PENDING"
    });

    return payment;
};

export const completePaymentService = async ({
    userId,
    paymentId,
    transactionId
}) => {
    const payment = await Payment.findOne({
        _id: paymentId,
        user: userId
    });

    if (!payment) {
        throw new Error("Payment not found");
    }

    if (payment.status === "SUCCESS") {
        throw new Error("Payment already completed");
    }

    const order = await Order.findOne({
        _id: payment.order,
        user: userId
    });

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.paymentStatus === "PAID") {
        throw new Error("Order is already paid");
    }

    for (const item of order.items) {
        const product = await Product.findById(
            item.product
        );

        if (!product) {
            throw new Error(
                `Product ${item.name} not found`
            );
        }

        if (product.stock < item.quantity) {
            throw new Error(
                `Insufficient stock for ${item.name}`
            );
        }
    }

    for (const item of order.items) {
        await Product.findByIdAndUpdate(
            item.product,
            {
                $inc: {
                    stock: -item.quantity
                }
            }
        );
    }

    payment.status = "SUCCESS";
    payment.transactionId =
        transactionId || null;

    await payment.save();

    order.paymentStatus = "PAID";
    order.orderStatus = "CONFIRMED";
    order.paymentId = transactionId || payment._id.toString();

    await order.save();

    const cart = await Cart.findOne({
        user: userId
    });

    if (cart) {
        cart.items = [];
        cart.subtotal = 0;

        await cart.save();
    }

    return {
        payment,
        order
    };
};

export const failPaymentService = async ({
    userId,
    paymentId,
    failureReason
}) => {
    const payment = await Payment.findOne({
        _id: paymentId,
        user: userId
    });

    if (!payment) {
        throw new Error("Payment not found");
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