import {
    getSummaryService,
    getSalesAnalyticsService,
    getOrderStatusBreakdownService,
    getRecentOrdersService,
    getTopProductsService,
    getLowStockProductsService,
    getCategoryPerformanceService,
    getTopCustomersService,
    getPaymentSummaryService
} from "../services/dashboard.service.js";

export const getSummary = async (req, res, next) => {
    try {
        const data = await getSummaryService();

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

export const getSalesAnalytics = async (req, res, next) => {
    try {
        const data = await getSalesAnalyticsService({
            range: req.query.range
        });

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

export const getOrderStatusBreakdown = async (
    req,
    res,
    next
) => {
    try {
        const data = await getOrderStatusBreakdownService();

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

export const getRecentOrders = async (req, res, next) => {
    try {
        const data = await getRecentOrdersService({
            limit: req.query.limit
        });

        res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        next(error);
    }
};

export const getTopProducts = async (req, res, next) => {
    try {
        const data = await getTopProductsService({
            limit: req.query.limit,
            range: req.query.range
        });

        res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        next(error);
    }
};

export const getLowStockProducts = async (req, res, next) => {
    try {
        const data = await getLowStockProductsService({
            threshold: req.query.threshold,
            limit: req.query.limit
        });

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

export const getCategoryPerformance = async (
    req,
    res,
    next
) => {
    try {
        const data = await getCategoryPerformanceService();

        res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        next(error);
    }
};

export const getTopCustomers = async (req, res, next) => {
    try {
        const data = await getTopCustomersService({
            limit: req.query.limit
        });

        res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        next(error);
    }
};

export const getPaymentSummary = async (req, res, next) => {
    try {
        const data = await getPaymentSummaryService();

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};
