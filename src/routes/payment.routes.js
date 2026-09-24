import express from "express";

import {
    createPayment,
    verifyPayment,
    failPayment,
    getPaymentByOrder,
    razorpayWebhook
} from "../controllers/payment.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

// Razorpay calls this server-to-server: no user token here.
router.post("/webhook", razorpayWebhook);

router.use(authMiddleware);

router.post("/", createPayment);

router.post("/verify", verifyPayment);

// the path the storefront used before /verify existed
router.post("/complete", verifyPayment);

router.post("/failed", failPayment);

router.get("/order/:orderId", getPaymentByOrder);

export default router;
