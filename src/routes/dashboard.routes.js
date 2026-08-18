import express from "express";

import {
    getSummary,
    getSalesAnalytics,
    getOrderStatusBreakdown,
    getRecentOrders,
    getTopProducts,
    getLowStockProducts,
    getCategoryPerformance,
    getTopCustomers,
    getPaymentSummary
} from "../controllers/dashboard.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";
import adminMiddleware from "../middlewares/admin.middleware.js";

const router = express.Router();

// Every dashboard endpoint is admin only.
router.use(authMiddleware, adminMiddleware);

// KPI cards
router.get("/summary", getSummary);

// Revenue / orders line chart
router.get("/sales", getSalesAnalytics);

// Order + payment status donut charts
router.get("/orders/status", getOrderStatusBreakdown);

// Latest orders table
router.get("/orders/recent", getRecentOrders);

// Best sellers table
router.get("/products/top", getTopProducts);

// Inventory alerts
router.get("/products/low-stock", getLowStockProducts);

// Revenue split by category
router.get("/categories/performance", getCategoryPerformance);

// Highest value customers
router.get("/customers/top", getTopCustomers);

// Payment status + method breakdown
router.get("/payments/summary", getPaymentSummary);

export default router;
