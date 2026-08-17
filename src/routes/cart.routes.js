import express from "express";

import {
    addToCart,
    getCart,
    updateCartItem,
    removeCartItem,
    clearCart
} from "../controllers/cart.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", addToCart);

router.get("/", getCart);

router.put("/", updateCartItem);

router.delete("/:productId", removeCartItem);

router.delete("/", clearCart);

export default router;