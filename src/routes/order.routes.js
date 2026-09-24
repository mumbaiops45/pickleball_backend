import express from "express";

import {
    createOrder,
    getMyOrders,
    getOrderById,
    cancelOrder,
    updateOrderStatus,
    shipOrder,
    syncOrderTracking
} from "../controllers/order.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";
import adminMiddleware from "../middlewares/admin.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", createOrder);

router.get("/", getMyOrders);

router.get("/:id", getOrderById);

router.patch("/:id/cancel", cancelOrder);

// Admin: move an order along, or hand it to Shiprocket.
router.patch("/:id/status", adminMiddleware, updateOrderStatus);

router.post("/:id/ship", adminMiddleware, shipOrder);

router.post("/:id/tracking/sync", adminMiddleware, syncOrderTracking);

export default router;
