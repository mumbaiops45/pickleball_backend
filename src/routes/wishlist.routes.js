import express from "express";

import {
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    toggleWishlist
} from "../controllers/wishlist.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

// Get user's wishlist
router.get("/", authMiddleware, getWishlist);

// Add product
router.post("/add", authMiddleware, addToWishlist);

// Remove product
router.delete("/:productId", authMiddleware, removeFromWishlist);

// Add/remove with one API
router.post("/toggle", authMiddleware, toggleWishlist);

export default router;