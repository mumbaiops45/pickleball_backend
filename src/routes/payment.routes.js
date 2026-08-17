import express from "express";

import {
    createPayment,
    completePayment,
    failPayment
} from "../controllers/payment.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", createPayment);

router.post("/complete", completePayment);

router.post("/failed", failPayment);

export default router;