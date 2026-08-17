import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";

export const addToCartService = async ({
    userId,
    productId,
    quantity
}) => {
    if (!productId || !quantity) {
        throw new Error("Product and quantity are required");
    }

    if (quantity < 1) {
        throw new Error("Quantity must be at least 1");
    }

    const product = await Product.findById(productId);

    if (!product) {
        throw new Error("Product not found");
    }

    if (!product.isActive) {
        throw new Error("Product is not available");
    }

    if (product.stock < quantity) {
        throw new Error("Insufficient stock");
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
        cart = await Cart.create({
            user: userId,
            items: [
                {
                    product: product._id,
                    quantity,
                    price: product.discountPrice ?? product.price
                }
            ]
        });
    } else {
        const existingItem = cart.items.find(
            (item) =>
                item.product.toString() === productId.toString()
        );

        if (existingItem) {
            const newQuantity =
                existingItem.quantity + quantity;

            if (newQuantity > product.stock) {
                throw new Error("Insufficient stock");
            }

            existingItem.quantity = newQuantity;
            existingItem.price =
                product.discountPrice ?? product.price;
        } else {
            cart.items.push({
                product: product._id,
                quantity,
                price: product.discountPrice ?? product.price
            });
        }

        await cart.save();
    }

    await calculateCartSubtotal(cart);

    return await Cart.findById(cart._id).populate(
        "items.product",
        "name price discountPrice images stock"
    );
};

export const getCartService = async (userId) => {
    const cart = await Cart.findOne({ user: userId }).populate(
        "items.product",
        "name price discountPrice images stock"
    );

    if (!cart) {
        return {
            user: userId,
            items: [],
            subtotal: 0
        };
    }

    return cart;
};

export const updateCartItemService = async ({
    userId,
    productId,
    quantity
}) => {
    if (!quantity || quantity < 1) {
        throw new Error("Quantity must be at least 1");
    }

    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
        throw new Error("Cart not found");
    }

    const item = cart.items.find(
        (item) =>
            item.product.toString() === productId.toString()
    );

    if (!item) {
        throw new Error("Product not found in cart");
    }

    const product = await Product.findById(productId);

    if (!product) {
        throw new Error("Product not found");
    }

    if (quantity > product.stock) {
        throw new Error("Insufficient stock");
    }

    item.quantity = quantity;
    item.price = product.discountPrice ?? product.price;

    await cart.save();

    await calculateCartSubtotal(cart);

    return await Cart.findById(cart._id).populate(
        "items.product",
        "name price discountPrice images stock"
    );
};

export const removeCartItemService = async ({
    userId,
    productId
}) => {
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
        throw new Error("Cart not found");
    }

    const itemExists = cart.items.some(
        (item) =>
            item.product.toString() === productId.toString()
    );

    if (!itemExists) {
        throw new Error("Product not found in cart");
    }

    cart.items = cart.items.filter(
        (item) =>
            item.product.toString() !== productId.toString()
    );

    await cart.save();

    await calculateCartSubtotal(cart);

    return await Cart.findById(cart._id).populate(
        "items.product",
        "name price discountPrice images stock"
    );
};

export const clearCartService = async (userId) => {
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
        throw new Error("Cart not found");
    }

    cart.items = [];
    cart.subtotal = 0;

    await cart.save();

    return cart;
};

const calculateCartSubtotal = async (cart) => {
    cart.subtotal = cart.items.reduce(
        (total, item) =>
            total + item.price * item.quantity,
        0
    );

    await cart.save();
};