import express from "express";

import {
    getSalesReport,
    getOrderReport,
    getProductReport,
    getInventoryReport,
    getCustomerReport,
    getPaymentReport
} from "../controllers/report.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";
import adminMiddleware from "../middlewares/admin.middleware.js";

const router = express.Router();

// Every report is admin only.
router.use(authMiddleware, adminMiddleware);

// Revenue grouped by day / week / month
router.get("/sales", getSalesReport);

// Row-per-order register
router.get("/orders", getOrderReport);

// Units and revenue per product
router.get("/products", getProductReport);

// Stock on hand and what it is worth
router.get("/inventory", getInventoryReport);

// Spend per customer
router.get("/customers", getCustomerReport);

// Payment ledger
router.get("/payments", getPaymentReport);

export default router;
