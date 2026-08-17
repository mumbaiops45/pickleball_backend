import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import Address from "../models/address.model.js";

const generateOrderNumber = () => {
    const timestamp = Date.now();

    const random = Math.floor(
        1000 + Math.random() * 9000
    );

    return `PB-${timestamp}-${random}`;
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
        const product = await Product.findById(
            cartItem.product._id
        );

        if (!product) {
            throw new Error(
                `Product ${cartItem.product.name} not found`
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

        const price =
            product.discountPrice ?? product.price;

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

    const shippingCharge = subtotal >= 2000 ? 0 : 100;

    const discount = 0;

    const totalAmount =
        subtotal +
        shippingCharge -
        discount;

    const shippingAddress = {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country
    };

    const order = await Order.create({
        orderNumber: generateOrderNumber(),

        user: userId,

        items: orderItems,

        shippingAddress,

        subtotal,

        shippingCharge,

        discount,

        totalAmount,

        paymentMethod,

        paymentStatus: "PENDING",

        orderStatus:
            paymentMethod === "COD"
                ? "CONFIRMED"
                : "PENDING"
    });

    if (paymentMethod === "COD") {
        for (const item of orderItems) {
            await Product.findByIdAndUpdate(
                item.product,
                {
                    $inc: {
                        stock: -item.quantity
                    }
                }
            );
        }

        cart.items = [];
        cart.subtotal = 0;

        await cart.save();
    }

    return order;
};

export const getMyOrdersService = async (userId) => {
    const orders = await Order.find({
        user: userId
    })
        .populate(
            "items.product",
            "name images"
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
        "name images"
    );

    if (!order) {
        throw new Error("Order not found");
    }

    return order;
};

export const cancelOrderService = async ({
    userId,
    orderId,
    reason
}) => {
    const order = await Order.findOne({
        _id: orderId,
        user: userId
    });

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

    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
    order.cancellationReason =
        reason || "Cancelled by customer";

    if (
        order.paymentStatus === "PAID"
    ) {
        order.paymentStatus = "REFUNDED";
    }

    for (const item of order.items) {
        await Product.findByIdAndUpdate(
            item.product,
            {
                $inc: {
                    stock: item.quantity
                }
            }
        );
    }

    await order.save();

    return order;
};