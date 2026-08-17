import express from "express";

import {
    createOrder,
    getMyOrders,
    getOrderById,
    cancelOrder
} from "../controllers/order.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", createOrder);

router.get("/", getMyOrders);

router.get("/:id", getOrderById);

router.patch("/:id/cancel", cancelOrder);

export default router;