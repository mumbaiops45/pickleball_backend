import {
    getSalesReportService,
    getOrderReportService,
    getProductReportService,
    getInventoryReportService,
    getCustomerReportService,
    getPaymentReportService
} from "../services/report.service.js";

import { sendCsv } from "../utils/csv.js";

const isCsv = (req) =>
    String(req.query.format || "").toLowerCase() === "csv";

const stamp = () =>
    new Date().toISOString().slice(0, 10);

/**
 * Every report answers JSON by default and the same rows as a
 * CSV download when `?format=csv` is passed.
 */
const respond = (req, res, { report, filename, columns }) => {
    if (isCsv(req)) {
        return sendCsv(
            res,
            `${filename}-${stamp()}.csv`,
            columns,
            report.rows
        );
    }

    return res.status(200).json({
        success: true,
        count: report.rows.length,
        data: report
    });
};

export const getSalesReport = async (req, res, next) => {
    try {
        const report = await getSalesReportService(req.query);

        respond(req, res, {
            report,
            filename: "sales-report",
            columns: [
                { key: "period", label: "Period" },
                { key: "orders", label: "Orders" },
                { key: "unitsSold", label: "Units" },
                { key: "itemsSubtotal", label: "Subtotal" },
                { key: "shipping", label: "Shipping" },
                { key: "discount", label: "Discount" },
                { key: "grossRevenue", label: "Revenue" },
                {
                    key: "averageOrderValue",
                    label: "Avg order value"
                }
            ]
        });
    } catch (error) {
        next(error);
    }
};

export const getOrderReport = async (req, res, next) => {
    try {
        const report = await getOrderReportService(req.query);

        respond(req, res, {
            report,
            filename: "order-report",
            columns: [
                { key: "orderNumber", label: "Order number" },
                { key: "placedAt", label: "Placed at" },
                { key: "customer", label: "Customer" },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                { key: "city", label: "City" },
                { key: "state", label: "State" },
                { key: "pincode", label: "Pincode" },
                { key: "items", label: "Lines" },
                { key: "units", label: "Units" },
                { key: "subtotal", label: "Subtotal" },
                { key: "shipping", label: "Shipping" },
                { key: "discount", label: "Discount" },
                { key: "totalAmount", label: "Total" },
                { key: "paymentMethod", label: "Method" },
                { key: "paymentStatus", label: "Payment" },
                { key: "orderStatus", label: "Status" },
                {
                    key: "cancellationReason",
                    label: "Cancellation reason"
                }
            ]
        });
    } catch (error) {
        next(error);
    }
};

export const getProductReport = async (req, res, next) => {
    try {
        const report = await getProductReportService(req.query);

        respond(req, res, {
            report,
            filename: "product-report",
            columns: [
                { key: "name", label: "Product" },
                { key: "sku", label: "SKU" },
                { key: "categoryName", label: "Category" },
                { key: "unitsSold", label: "Units sold" },
                { key: "orders", label: "Orders" },
                { key: "revenue", label: "Revenue" },
                {
                    key: "averageSellingPrice",
                    label: "Avg selling price"
                },
                { key: "currentStock", label: "Stock now" },
                { key: "isActive", label: "Active" }
            ]
        });
    } catch (error) {
        next(error);
    }
};

export const getInventoryReport = async (req, res, next) => {
    try {
        const report = await getInventoryReportService(
            req.query
        );

        respond(req, res, {
            report,
            filename: "inventory-report",
            columns: [
                { key: "name", label: "Product" },
                { key: "sku", label: "SKU" },
                { key: "category", label: "Category" },
                { key: "stock", label: "Stock" },
                { key: "price", label: "Price" },
                { key: "discountPrice", label: "Discount price" },
                { key: "stockValue", label: "Stock value" },
                { key: "status", label: "Status" },
                { key: "isActive", label: "Active" },
                { key: "severity", label: "Alert" }
            ]
        });
    } catch (error) {
        next(error);
    }
};

export const getCustomerReport = async (req, res, next) => {
    try {
        const report = await getCustomerReportService(req.query);

        respond(req, res, {
            report,
            filename: "customer-report",
            columns: [
                { key: "name", label: "Customer" },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                { key: "orders", label: "Orders" },
                { key: "totalSpent", label: "Total spent" },
                {
                    key: "averageOrderValue",
                    label: "Avg order value"
                },
                { key: "firstOrderAt", label: "First order" },
                { key: "lastOrderAt", label: "Last order" },
                { key: "registeredAt", label: "Registered" },
                { key: "isBlocked", label: "Blocked" }
            ]
        });
    } catch (error) {
        next(error);
    }
};

export const getPaymentReport = async (req, res, next) => {
    try {
        const report = await getPaymentReportService(req.query);

        respond(req, res, {
            report,
            filename: "payment-report",
            columns: [
                { key: "createdAt", label: "Date" },
                { key: "orderNumber", label: "Order number" },
                { key: "customer", label: "Customer" },
                { key: "email", label: "Email" },
                { key: "amount", label: "Amount" },
                { key: "currency", label: "Currency" },
                { key: "method", label: "Method" },
                { key: "status", label: "Status" },
                { key: "transactionId", label: "Transaction id" },
                { key: "failureReason", label: "Failure reason" }
            ]
        });
    } catch (error) {
        next(error);
    }
};
