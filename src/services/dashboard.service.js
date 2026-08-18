import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import Payment from "../models/payment.model.js";
import Cart from "../models/cart.model.js";
import Category from "../models/category.model.js";
import Wishlist from "../models/wishlist.model.js";

const TIMEZONE =
    process.env.DASHBOARD_TIMEZONE || "Asia/Kolkata";

// Cancelled orders are never counted as revenue.
const REVENUE_MATCH = {
    orderStatus: { $ne: "CANCELLED" }
};

const DEFAULT_LOW_STOCK_THRESHOLD = Number(
    process.env.LOW_STOCK_THRESHOLD || 5
);

const RANGES = {
    "7d": { unit: "day", length: 7 },
    "30d": { unit: "day", length: 30 },
    "90d": { unit: "day", length: 90 },
    "12m": { unit: "month", length: 12 }
};

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});

const toDayKey = (date) => dayFormatter.format(date);

const toMonthKey = (date) => toDayKey(date).slice(0, 7);

const clampLimit = (value, fallback, max = 100) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }

    return Math.min(Math.floor(parsed), max);
};

const round = (value) => Number((value || 0).toFixed(2));

const percentChange = (current, previous) => {
    if (!previous) {
        return current ? 100 : 0;
    }

    return round(((current - previous) / previous) * 100);
};

/**
 * Builds the bucket list (oldest -> newest) plus the `from`
 * date used to filter orders, for a given range key.
 */
const resolveRange = (rangeKey) => {
    const key = RANGES[rangeKey] ? rangeKey : "30d";

    const range = RANGES[key];

    const now = new Date();

    const buckets = [];

    if (range.unit === "day") {
        for (let i = range.length - 1; i >= 0; i -= 1) {
            buckets.push(
                toDayKey(new Date(now.getTime() - i * 86400000))
            );
        }

        return {
            key,
            unit: "day",
            format: "%Y-%m-%d",
            buckets,
            from: new Date(
                now.getTime() - (range.length - 1) * 86400000
            )
        };
    }

    const [year, month] = toMonthKey(now)
        .split("-")
        .map(Number);

    for (let i = range.length - 1; i >= 0; i -= 1) {
        const cursor = new Date(Date.UTC(year, month - 1 - i, 1));

        buckets.push(
            `${cursor.getUTCFullYear()}-${String(
                cursor.getUTCMonth() + 1
            ).padStart(2, "0")}`
        );
    }

    return {
        key,
        unit: "month",
        format: "%Y-%m",
        buckets,
        from: new Date(Date.UTC(year, month - range.length, 1))
    };
};

const sumOrders = async (match) => {
    const [result] = await Order.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                revenue: { $sum: "$totalAmount" },
                orders: { $sum: 1 }
            }
        }
    ]);

    return {
        revenue: round(result?.revenue),
        orders: result?.orders || 0
    };
};

export const getSummaryService = async () => {
    const now = Date.now();

    const last30From = new Date(now - 30 * 86400000);
    const prev30From = new Date(now - 60 * 86400000);

    const [
        allTime,
        paidAgg,
        last30,
        prev30,
        statusAgg,
        customers,
        newCustomers,
        products,
        activeProducts,
        outOfStock,
        lowStock,
        categories,
        activeCarts,
        wishlistItems
    ] = await Promise.all([
        sumOrders(REVENUE_MATCH),

        Order.aggregate([
            { $match: { paymentStatus: "PAID" } },
            {
                $group: {
                    _id: null,
                    revenue: { $sum: "$totalAmount" }
                }
            }
        ]),

        sumOrders({
            ...REVENUE_MATCH,
            createdAt: { $gte: last30From }
        }),

        sumOrders({
            ...REVENUE_MATCH,
            createdAt: { $gte: prev30From, $lt: last30From }
        }),

        Order.aggregate([
            {
                $group: {
                    _id: "$orderStatus",
                    count: { $sum: 1 }
                }
            }
        ]),

        User.countDocuments({ role: "CUSTOMER" }),

        User.countDocuments({
            role: "CUSTOMER",
            createdAt: { $gte: last30From }
        }),

        Product.countDocuments(),

        Product.countDocuments({
            isActive: true,
            status: "PUBLISHED"
        }),

        Product.countDocuments({ stock: { $lte: 0 } }),

        Product.countDocuments({
            stock: { $gt: 0, $lte: DEFAULT_LOW_STOCK_THRESHOLD }
        }),

        Category.countDocuments(),

        Cart.countDocuments({ "items.0": { $exists: true } }),

        Wishlist.countDocuments()
    ]);

    const orderStatus = {
        PENDING: 0,
        CONFIRMED: 0,
        PROCESSING: 0,
        SHIPPED: 0,
        DELIVERED: 0,
        CANCELLED: 0
    };

    statusAgg.forEach((row) => {
        orderStatus[row._id] = row.count;
    });

    return {
        totals: {
            revenue: allTime.revenue,
            paidRevenue: round(paidAgg[0]?.revenue),
            orders: allTime.orders,
            averageOrderValue: allTime.orders
                ? round(allTime.revenue / allTime.orders)
                : 0,
            customers,
            products,
            activeProducts,
            categories,
            outOfStockProducts: outOfStock,
            lowStockProducts: lowStock,
            activeCarts,
            wishlistItems
        },
        orderStatus,
        last30Days: {
            revenue: last30.revenue,
            orders: last30.orders,
            newCustomers,
            revenueChangePct: percentChange(
                last30.revenue,
                prev30.revenue
            ),
            ordersChangePct: percentChange(
                last30.orders,
                prev30.orders
            )
        },
        meta: {
            timezone: TIMEZONE,
            lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
            revenueRule:
                "Excludes orders with orderStatus CANCELLED"
        }
    };
};

export const getSalesAnalyticsService = async ({ range } = {}) => {
    const resolved = resolveRange(range);

    const rows = await Order.aggregate([
        {
            $match: {
                ...REVENUE_MATCH,
                createdAt: { $gte: resolved.from }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: resolved.format,
                        date: "$createdAt",
                        timezone: TIMEZONE
                    }
                },
                revenue: { $sum: "$totalAmount" },
                orders: { $sum: 1 },
                units: { $sum: { $sum: "$items.quantity" } }
            }
        }
    ]);

    const byKey = new Map(rows.map((row) => [row._id, row]));

    const series = resolved.buckets.map((bucket) => ({
        period: bucket,
        revenue: round(byKey.get(bucket)?.revenue),
        orders: byKey.get(bucket)?.orders || 0,
        units: byKey.get(bucket)?.units || 0
    }));

    const revenue = round(
        series.reduce((sum, point) => sum + point.revenue, 0)
    );

    const orders = series.reduce(
        (sum, point) => sum + point.orders,
        0
    );

    return {
        range: resolved.key,
        granularity: resolved.unit,
        timezone: TIMEZONE,
        totals: {
            revenue,
            orders,
            averageOrderValue: orders ? round(revenue / orders) : 0
        },
        series
    };
};

export const getOrderStatusBreakdownService = async () => {
    const [orderRows, paymentRows] = await Promise.all([
        Order.aggregate([
            {
                $group: {
                    _id: "$orderStatus",
                    count: { $sum: 1 },
                    amount: { $sum: "$totalAmount" }
                }
            },
            { $sort: { count: -1 } }
        ]),

        Order.aggregate([
            {
                $group: {
                    _id: "$paymentStatus",
                    count: { $sum: 1 },
                    amount: { $sum: "$totalAmount" }
                }
            },
            { $sort: { count: -1 } }
        ])
    ]);

    const shape = (rows) =>
        rows.map((row) => ({
            status: row._id,
            count: row.count,
            amount: round(row.amount)
        }));

    return {
        orderStatus: shape(orderRows),
        paymentStatus: shape(paymentRows)
    };
};

export const getRecentOrdersService = async ({ limit } = {}) => {
    const orders = await Order.find()
        .select(
            "orderNumber totalAmount orderStatus paymentStatus paymentMethod createdAt items shippingAddress.fullName"
        )
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .limit(clampLimit(limit, 10, 50))
        .lean();

    return orders.map((order) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        customer:
            order.user?.name ||
            order.shippingAddress?.fullName ||
            "Guest",
        email: order.user?.email || null,
        phone: order.user?.phone || null,
        itemCount: order.items?.length || 0,
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt
    }));
};

export const getTopProductsService = async ({
    limit,
    range
} = {}) => {
    const match = { ...REVENUE_MATCH };

    if (range) {
        match.createdAt = { $gte: resolveRange(range).from };
    }

    const rows = await Order.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
            $group: {
                _id: "$items.product",
                name: { $first: "$items.name" },
                image: { $first: "$items.image" },
                unitsSold: { $sum: "$items.quantity" },
                revenue: { $sum: "$items.total" },
                orders: { $sum: 1 }
            }
        },
        { $sort: { revenue: -1 } },
        { $limit: clampLimit(limit, 10, 50) },
        {
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "product"
            }
        },
        {
            $project: {
                _id: 0,
                productId: "$_id",
                name: 1,
                image: 1,
                unitsSold: 1,
                revenue: 1,
                orders: 1,
                sku: { $first: "$product.sku" },
                stock: { $first: "$product.stock" },
                isActive: { $first: "$product.isActive" }
            }
        }
    ]);

    return rows.map((row) => ({
        ...row,
        revenue: round(row.revenue)
    }));
};

export const getLowStockProductsService = async ({
    threshold,
    limit
} = {}) => {
    const parsed = Number(threshold);

    const effectiveThreshold =
        Number.isFinite(parsed) && parsed >= 0
            ? Math.floor(parsed)
            : DEFAULT_LOW_STOCK_THRESHOLD;

    const products = await Product.find({
        stock: { $lte: effectiveThreshold }
    })
        .select(
            "name sku stock price discountPrice status isActive images"
        )
        .populate("category", "name")
        .sort({ stock: 1, name: 1 })
        .limit(clampLimit(limit, 20, 100))
        .lean();

    return {
        threshold: effectiveThreshold,
        count: products.length,
        products: products.map((product) => ({
            id: product._id,
            name: product.name,
            sku: product.sku,
            category: product.category?.name || null,
            stock: product.stock,
            price: product.discountPrice ?? product.price,
            status: product.status,
            isActive: product.isActive,
            image: product.images?.[0] || null,
            severity:
                product.stock <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK"
        }))
    };
};

export const getCategoryPerformanceService = async () => {
    const rows = await Order.aggregate([
        { $match: REVENUE_MATCH },
        { $unwind: "$items" },
        {
            $lookup: {
                from: "products",
                localField: "items.product",
                foreignField: "_id",
                as: "product"
            }
        },
        { $unwind: "$product" },
        {
            $group: {
                _id: "$product.category",
                unitsSold: { $sum: "$items.quantity" },
                revenue: { $sum: "$items.total" }
            }
        },
        {
            $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "_id",
                as: "category"
            }
        },
        {
            $project: {
                _id: 0,
                categoryId: "$_id",
                name: {
                    $ifNull: [
                        { $first: "$category.name" },
                        "Uncategorised"
                    ]
                },
                unitsSold: 1,
                revenue: 1
            }
        },
        { $sort: { revenue: -1 } }
    ]);

    const total = rows.reduce((sum, row) => sum + row.revenue, 0);

    return rows.map((row) => ({
        ...row,
        revenue: round(row.revenue),
        sharePct: total ? round((row.revenue / total) * 100) : 0
    }));
};

export const getTopCustomersService = async ({ limit } = {}) => {
    const rows = await Order.aggregate([
        { $match: REVENUE_MATCH },
        {
            $group: {
                _id: "$user",
                orders: { $sum: 1 },
                totalSpent: { $sum: "$totalAmount" },
                lastOrderAt: { $max: "$createdAt" }
            }
        },
        { $sort: { totalSpent: -1 } },
        { $limit: clampLimit(limit, 10, 50) },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $project: {
                _id: 0,
                userId: "$_id",
                name: { $first: "$user.name" },
                email: { $first: "$user.email" },
                phone: { $first: "$user.phone" },
                orders: 1,
                totalSpent: 1,
                lastOrderAt: 1
            }
        }
    ]);

    return rows.map((row) => ({
        ...row,
        totalSpent: round(row.totalSpent),
        averageOrderValue: row.orders
            ? round(row.totalSpent / row.orders)
            : 0
    }));
};

export const getPaymentSummaryService = async () => {
    const [byStatus, byMethod] = await Promise.all([
        Payment.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    amount: { $sum: "$amount" }
                }
            },
            { $sort: { amount: -1 } }
        ]),

        Order.aggregate([
            { $match: REVENUE_MATCH },
            {
                $group: {
                    _id: "$paymentMethod",
                    orders: { $sum: 1 },
                    amount: { $sum: "$totalAmount" }
                }
            },
            { $sort: { amount: -1 } }
        ])
    ]);

    return {
        payments: byStatus.map((row) => ({
            status: row._id,
            count: row.count,
            amount: round(row.amount)
        })),
        orderPaymentMethods: byMethod.map((row) => ({
            method: row._id,
            orders: row.orders,
            amount: round(row.amount)
        }))
    };
};
