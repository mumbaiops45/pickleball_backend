import {
    addToCartService,
    getCartService,
    updateCartItemService,
    removeCartItemService,
    clearCartService
} from "../services/cart.service.js";

export const addToCart = async (req, res, next) => {
    try {
        const { productId, quantity } = req.body;

        const cart = await addToCartService({
            userId: req.user._id,
            productId,
            quantity
        });

        res.status(200).json({
            success: true,
            message: "Product added to cart successfully",
            data: cart
        });
    } catch (error) {
        next(error);
    }
};

export const getCart = async (req, res, next) => {
    try {
        const cart = await getCartService(req.user._id);

        res.status(200).json({
            success: true,
            data: cart
        });
    } catch (error) {
        next(error);
    }
};

export const updateCartItem = async (req, res, next) => {
    try {
        const { productId, quantity } = req.body;

        const cart = await updateCartItemService({
            userId: req.user._id,
            productId,
            quantity
        });

        res.status(200).json({
            success: true,
            message: "Cart item updated successfully",
            data: cart
        });
    } catch (error) {
        next(error);
    }
};

export const removeCartItem = async (req, res, next) => {
    try {
        const { productId } = req.params;

        const cart = await removeCartItemService({
            userId: req.user._id,
            productId
        });

        res.status(200).json({
            success: true,
            message: "Product removed from cart successfully",
            data: cart
        });
    } catch (error) {
        next(error);
    }
};

export const clearCart = async (req, res, next) => {
    try {
        const cart = await clearCartService(req.user._id);

        res.status(200).json({
            success: true,
            message: "Cart cleared successfully",
            data: cart
        });
    } catch (error) {
        next(error);
    }
};