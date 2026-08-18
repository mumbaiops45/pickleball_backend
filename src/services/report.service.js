import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import Payment from "../models/payment.model.js";
import mongoose from "mongoose";

const TIMEZONE =
    process.env.DASHBOARD_TIMEZONE || "Asia/Kolkata";

const LOW_STOCK_THRESHOLD = Number(
    process.env.LOW_STOCK_THRESHOLD || 5
);

// Reports never count cancelled orders as sales.
const SOLD_MATCH = { orderStatus: { $ne: "CANCELLED" } };

const GROUP_FORMATS = {
    day: "%Y-%m-%d",
    week: "%G-W%V",
    month: "%Y-%m"
};

const round = (value) => Number((value || 0).toFixed(2));

/**
 * Milliseconds that `tz` is ahead of UTC at the given instant.
 */
const tzOffsetMs = (date, tz) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            hour12: false,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        })
            .formatToParts(date)
            .map((part) => [part.type, part.value])
    );

    const asUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour) % 24,
        Number(parts.minute),
        Number(parts.second)
    );

    // `asUtc` is second-precision, so compare it against the
    // instant truncated the same way or the offset drifts by
    // up to a second and `to` spills into the next day.
    return asUtc - (date.getTime() - date.getMilliseconds());
};

/**
 * Reads a wall-clock string as a time in TIMEZONE rather than UTC,
 * so `from=2026-08-01` means midnight where the shop operates.
 */
const parseInZone = (text, endOfDay) => {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);

    const stamped = dateOnly
        ? `${text}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
        : text.endsWith("Z")
          ? text
          : `${text}Z`;

    const guess = Date.parse(stamped);

    if (Number.isNaN(guess)) {
        return null;
    }

    // Two passes settle the offset across a DST boundary.
    let result = guess - tzOffsetMs(new Date(guess), TIMEZONE);

    result = guess - tzOffsetMs(new Date(result), TIMEZONE);

    return new Date(result);
};

export const parseDateRange = ({ from, to } = {}) => {
    const now = new Date();

    let start;
    let end;

    if (from) {
        start = parseInZone(String(from), false);

        if (!start) {
            throw new Error(
                "Invalid `from` date — use YYYY-MM-DD or an ISO timestamp"
            );
        }
    } else {
        start = new Date(now.getTime() - 30 * 86400000);
    }

    if (to) {
        end = parseInZone(String(to), true);

        if (!end) {
            throw new Error(
                "Invalid `to` date — use YYYY-MM-DD or an ISO timestamp"
            );
        }
    } else {
        end = now;
    }

    if (start > end) {
        throw new Error(
            "Invalid date range — `from` is after `to`"
        );
    }

    return { from: start, to: end };
};

const paginate = ({ page, limit }, fallbackLimit = 50) => {
    const parsedPage = Number(page);

    const parsedLimit = Number(limit);

    const safePage =
        Number.isFinite(parsedPage) && parsedPage >= 1
            ? Math.floor(parsedPage)
            : 1;

    const safeLimit =
        Number.isFinite(parsedLimit) && parsedLimit >= 1
            ? Math.min(Math.floor(parsedLimit), 500)
            : fallbackLimit;

    return {
        page: safePage,
        limit: safeLimit,
        skip: (safePage - 1) * safeLimit
    };
};

const pageMeta = (page, limit, total) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
    hasNext: page * limit < total,
    hasPrev: page > 1
});

const objectIdOrNull = (value) =>
    value && mongoose.Types.ObjectId.isValid(value)
        ? new mongoose.Types.ObjectId(String(value))
        : null;

/* ------------------------------------------------------------------ *
 * 1. Sales report — money in, grouped by period
 * ------------------------------------------------------------------ */
export const getSalesReportService = async ({
    from,
    to,
    groupBy
} = {}) => {
    const range = parseDateRange({ from, to });

    const key = GROUP_FORMATS[groupBy] ? groupBy : "day";

    const match = {
        ...SOLD_MATCH,
        createdAt: { $gte: range.from, $lte: range.to }
    };

    const [rows, [totals]] = await Promise.all([
        Order.aggregate([
            { $match: match },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: GROUP_FORMATS[key],
                            date: "$createdAt",
                            timezone: TIMEZONE
                        }
                    },
                    orders: { $sum: 1 },
                    itemsSubtotal: { $sum: "$subtotal" },
                    shipping: { $sum: "$shippingCharge" },
                    discount: { $sum: "$discount" },
                    grossRevenue: { $sum: "$totalAmount" },
                    unitsSold: {
                        $sum: { $sum: "$items.quantity" }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]),

        Order.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    orders: { $sum: 1 },
                    itemsSubtotal: { $sum: "$subtotal" },
                    shipping: { $sum: "$shippingCharge" },
                    discount: { $sum: "$discount" },
                    grossRevenue: { $sum: "$totalAmount" },
                    unitsSold: {
                        $sum: { $sum: "$items.quantity" }
                    },
                    paidRevenue: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: [
                                        "$paymentStatus",
                                        "PAID"
                                    ]
                                },
                                "$totalAmount",
                                0
                            ]
                        }
                    }
                }
            }
        ])
    ]);

    return {
        range: {
            from: range.from,
            to: range.to,
            groupBy: key,
            timezone: TIMEZONE
        },
        totals: {
            orders: totals?.orders || 0,
            unitsSold: totals?.unitsSold || 0,
            itemsSubtotal: round(totals?.itemsSubtotal),
            shipping: round(totals?.shipping),
            discount: round(totals?.discount),
            grossRevenue: round(totals?.grossRevenue),
            paidRevenue: round(totals?.paidRevenue),
            averageOrderValue: totals?.orders
                ? round(totals.grossRevenue / totals.orders)
                : 0
        },
        rows: rows.map((row) => ({
            period: row._id,
            orders: row.orders,
            unitsSold: row.unitsSold,
            itemsSubtotal: round(row.itemsSubtotal),
            shipping: round(row.shipping),
            discount: round(row.discount),
            grossRevenue: round(row.grossRevenue),
            averageOrderValue: row.orders
                ? round(row.grossRevenue / row.orders)
                : 0
        }))
    };
};

/* ------------------------------------------------------------------ *
 * 2. Order report — one row per order, filterable
 * ------------------------------------------------------------------ */
export const getOrderReportService = async ({
    from,
    to,
    orderStatus,
    paymentStatus,
    paymentMethod,
    search,
    page,
    limit
} = {}) => {
    const range = parseDateRange({ from, to });

    const filter = {
        createdAt: { $gte: range.from, $lte: range.to }
    };

    if (orderStatus) {
        filter.orderStatus = String(orderStatus).toUpperCase();
    }

    if (paymentStatus) {
        filter.paymentStatus = String(
            paymentStatus
        ).toUpperCase();
    }

    if (paymentMethod) {
        filter.paymentMethod = String(
            paymentMethod
        ).toUpperCase();
    }

    if (search) {
        filter.orderNumber = {
            $regex: String(search).trim(),
            $options: "i"
        };
    }

    const { page: safePage, limit: safeLimit, skip } =
        paginate({ page, limit });

    const [orders, total, [totals]] = await Promise.all([
        Order.find(filter)
            .populate("user", "name email phone")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .lean(),

        Order.countDocuments(filter),

        Order.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    grossRevenue: { $sum: "$totalAmount" },
                    shipping: { $sum: "$shippingCharge" },
                    units: {
                        $sum: { $sum: "$items.quantity" }
                    }
                }
            }
        ])
    ]);

    return {
        range: {
            from: range.from,
            to: range.to,
            timezone: TIMEZONE
        },
        filters: {
            orderStatus: filter.orderStatus || null,
            paymentStatus: filter.paymentStatus || null,
            paymentMethod: filter.paymentMethod || null,
            search: search || null
        },
        totals: {
            matchedOrders: total,
            grossRevenue: round(totals?.grossRevenue),
            shipping: round(totals?.shipping),
            unitsSold: totals?.units || 0
        },
        pagination: pageMeta(safePage, safeLimit, total),
        rows: orders.map((order) => ({
            orderNumber: order.orderNumber,
            placedAt: order.createdAt,
            customer:
                order.user?.name ||
                order.shippingAddress?.fullName ||
                "Unknown",
            email: order.user?.email || null,
            phone:
                order.user?.phone ||
                order.shippingAddress?.phone ||
                null,
            city: order.shippingAddress?.city || null,
            state: order.shippingAddress?.state || null,
            pincode: order.shippingAddress?.pincode || null,
            items: order.items?.length || 0,
            units:
                order.items?.reduce(
                    (sum, item) => sum + item.quantity,
                    0
                ) || 0,
            subtotal: order.subtotal,
            shipping: order.shippingCharge,
            discount: order.discount,
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            cancelledAt: order.cancelledAt || null,
            cancellationReason: order.cancellationReason || null
        }))
    };
};

/* ------------------------------------------------------------------ *
 * 3. Product performance report
 * ------------------------------------------------------------------ */
export const getProductReportService = async ({
    from,
    to,
    categoryId,
    sort,
    page,
    limit
} = {}) => {
    const range = parseDateRange({ from, to });

    const { page: safePage, limit: safeLimit, skip } =
        paginate({ page, limit });

    const sortKey =
        sort === "units"
            ? { unitsSold: -1 }
            : sort === "name"
              ? { name: 1 }
              : { revenue: -1 };

    const category = objectIdOrNull(categoryId);

    const pipeline = [
        {
            $match: {
                ...SOLD_MATCH,
                createdAt: { $gte: range.from, $lte: range.to }
            }
        },
        { $unwind: "$items" },
        {
            $group: {
                _id: "$items.product",
                name: { $first: "$items.name" },
                unitsSold: { $sum: "$items.quantity" },
                revenue: { $sum: "$items.total" },
                orders: { $addToSet: "$_id" }
            }
        },
        {
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "product"
            }
        },
        {
            $lookup: {
                from: "categories",
                localField: "product.category",
                foreignField: "_id",
                as: "category"
            }
        },
        {
            $project: {
                _id: 0,
                productId: "$_id",
                name: 1,
                unitsSold: 1,
                revenue: 1,
                orders: { $size: "$orders" },
                sku: { $first: "$product.sku" },
                categoryId: { $first: "$product.category" },
                categoryName: { $first: "$category.name" },
                currentStock: { $first: "$product.stock" },
                currentPrice: { $first: "$product.price" },
                isActive: { $first: "$product.isActive" }
            }
        }
    ];

    if (category) {
        pipeline.push({
            $match: { categoryId: category }
        });
    }

    const [result] = await Order.aggregate([
        ...pipeline,
        {
            $facet: {
                rows: [
                    { $sort: sortKey },
                    { $skip: skip },
                    { $limit: safeLimit }
                ],
                total: [{ $count: "count" }],
                totals: [
                    {
                        $group: {
                            _id: null,
                            revenue: { $sum: "$revenue" },
                            unitsSold: { $sum: "$unitsSold" }
                        }
                    }
                ]
            }
        }
    ]);

    const total = result?.total?.[0]?.count || 0;

    return {
        range: {
            from: range.from,
            to: range.to,
            timezone: TIMEZONE
        },
        totals: {
            productsSold: total,
            unitsSold: result?.totals?.[0]?.unitsSold || 0,
            revenue: round(result?.totals?.[0]?.revenue)
        },
        pagination: pageMeta(safePage, safeLimit, total),
        rows: (result?.rows || []).map((row) => ({
            ...row,
            categoryName: row.categoryName || "Uncategorised",
            revenue: round(row.revenue),
            averageSellingPrice: row.unitsSold
                ? round(row.revenue / row.unitsSold)
                : 0
        }))
    };
};

/* ------------------------------------------------------------------ *
 * 4. Inventory & stock valuation report (point in time, no range)
 * ------------------------------------------------------------------ */
export const getInventoryReportService = async ({
    filter,
    categoryId,
    page,
    limit
} = {}) => {
    const { page: safePage, limit: safeLimit, skip } =
        paginate({ page, limit }, 100);

    const query = {};

    const mode = String(filter || "all").toLowerCase();

    if (mode === "out") {
        query.stock = { $lte: 0 };
    } else if (mode === "low") {
        query.stock = { $gt: 0, $lte: LOW_STOCK_THRESHOLD };
    } else if (mode === "alert") {
        query.stock = { $lte: LOW_STOCK_THRESHOLD };
    } else if (mode === "instock") {
        query.stock = { $gt: LOW_STOCK_THRESHOLD };
    }

    const category = objectIdOrNull(categoryId);

    if (category) {
        query.category = category;
    }

    const [products, total, [valuation]] = await Promise.all([
        Product.find(query)
            .populate("category", "name")
            .sort({ stock: 1, name: 1 })
            .skip(skip)
            .limit(safeLimit)
            .lean(),

        Product.countDocuments(query),

        Product.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    units: { $sum: "$stock" },
                    retailValue: {
                        $sum: {
                            $multiply: ["$stock", "$price"]
                        }
                    },
                    sellingValue: {
                        $sum: {
                            $multiply: [
                                "$stock",
                                {
                                    $ifNull: [
                                        "$discountPrice",
                                        "$price"
                                    ]
                                }
                            ]
                        }
                    },
                    outOfStock: {
                        $sum: {
                            $cond: [
                                { $lte: ["$stock", 0] },
                                1,
                                0
                            ]
                        }
                    },
                    lowStock: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ["$stock", 0] },
                                        {
                                            $lte: [
                                                "$stock",
                                                LOW_STOCK_THRESHOLD
                                            ]
                                        }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ])
    ]);

    return {
        filter: mode,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        totals: {
            products: total,
            unitsInStock: valuation?.units || 0,
            retailValue: round(valuation?.retailValue),
            sellingValue: round(valuation?.sellingValue),
            outOfStock: valuation?.outOfStock || 0,
            lowStock: valuation?.lowStock || 0
        },
        pagination: pageMeta(safePage, safeLimit, total),
        rows: products.map((product) => {
            const effective =
                product.discountPrice ?? product.price;

            return {
                productId: product._id,
                name: product.name,
                sku: product.sku,
                category: product.category?.name || null,
                stock: product.stock,
                price: product.price,
                discountPrice: product.discountPrice ?? null,
                stockValue: round(product.stock * effective),
                status: product.status,
                isActive: product.isActive,
                severity:
                    product.stock <= 0
                        ? "OUT_OF_STOCK"
                        : product.stock <= LOW_STOCK_THRESHOLD
                          ? "LOW_STOCK"
                          : "OK"
            };
        })
    };
};

/* ------------------------------------------------------------------ *
 * 5. Customer report — every customer, with in-range order stats
 * ------------------------------------------------------------------ */
export const getCustomerReportService = async ({
    from,
    to,
    sort,
    onlyBuyers,
    page,
    limit
} = {}) => {
    const range = parseDateRange({ from, to });

    const { page: safePage, limit: safeLimit, skip } =
        paginate({ page, limit });

    const sortKey =
        sort === "orders"
            ? { orders: -1 }
            : sort === "recent"
              ? { lastOrderAt: -1 }
              : sort === "registered"
                ? { registeredAt: -1 }
                : { totalSpent: -1 };

    const pipeline = [
        { $match: { role: "CUSTOMER" } },
        {
            $lookup: {
                from: "orders",
                let: { customerId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            "$user",
                                            "$$customerId"
                                        ]
                                    },
                                    {
                                        $ne: [
                                            "$orderStatus",
                                            "CANCELLED"
                                        ]
                                    },
                                    {
                                        $gte: [
                                            "$createdAt",
                                            range.from
                                        ]
                                    },
                                    {
                                        $lte: [
                                            "$createdAt",
                                            range.to
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            orders: { $sum: 1 },
                            totalSpent: {
                                $sum: "$totalAmount"
                            },
                            firstOrderAt: {
                                $min: "$createdAt"
                            },
                            lastOrderAt: {
                                $max: "$createdAt"
                            }
                        }
                    }
                ],
                as: "stats"
            }
        },
        {
            $project: {
                _id: 0,
                customerId: "$_id",
                name: 1,
                email: 1,
                phone: 1,
                isBlocked: 1,
                registeredAt: "$createdAt",
                lastLoginAt: 1,
                orders: {
                    $ifNull: [
                        { $first: "$stats.orders" },
                        0
                    ]
                },
                totalSpent: {
                    $ifNull: [
                        { $first: "$stats.totalSpent" },
                        0
                    ]
                },
                firstOrderAt: {
                    $first: "$stats.firstOrderAt"
                },
                lastOrderAt: {
                    $first: "$stats.lastOrderAt"
                }
            }
        }
    ];

    if (String(onlyBuyers) === "true") {
        pipeline.push({ $match: { orders: { $gt: 0 } } });
    }

    const [result] = await User.aggregate([
        ...pipeline,
        {
            $facet: {
                rows: [
                    { $sort: sortKey },
                    { $skip: skip },
                    { $limit: safeLimit }
                ],
                total: [{ $count: "count" }],
                totals: [
                    {
                        $group: {
                            _id: null,
                            revenue: { $sum: "$totalSpent" },
                            orders: { $sum: "$orders" },
                            buyers: {
                                $sum: {
                                    $cond: [
                                        { $gt: ["$orders", 0] },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ]
            }
        }
    ]);

    const total = result?.total?.[0]?.count || 0;

    const summary = result?.totals?.[0];

    return {
        range: {
            from: range.from,
            to: range.to,
            timezone: TIMEZONE
        },
        totals: {
            customers: total,
            buyersInRange: summary?.buyers || 0,
            orders: summary?.orders || 0,
            revenue: round(summary?.revenue)
        },
        pagination: pageMeta(safePage, safeLimit, total),
        rows: (result?.rows || []).map((row) => ({
            ...row,
            totalSpent: round(row.totalSpent),
            averageOrderValue: row.orders
                ? round(row.totalSpent / row.orders)
                : 0,
            firstOrderAt: row.firstOrderAt || null,
            lastOrderAt: row.lastOrderAt || null
        }))
    };
};

/* ------------------------------------------------------------------ *
 * 6. Payment ledger report
 * ------------------------------------------------------------------ */
export const getPaymentReportService = async ({
    from,
    to,
    status,
    method,
    page,
    limit
} = {}) => {
    const range = parseDateRange({ from, to });

    const filter = {
        createdAt: { $gte: range.from, $lte: range.to }
    };

    if (status) {
        filter.status = String(status).toUpperCase();
    }

    if (method) {
        filter.method = String(method).toUpperCase();
    }

    const { page: safePage, limit: safeLimit, skip } =
        paginate({ page, limit });

    const [payments, total, byStatus] = await Promise.all([
        Payment.find(filter)
            .populate("order", "orderNumber orderStatus")
            .populate("user", "name email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .lean(),

        Payment.countDocuments(filter),

        Payment.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    amount: { $sum: "$amount" }
                }
            },
            { $sort: { amount: -1 } }
        ])
    ]);

    const settled = byStatus.find(
        (row) => row._id === "SUCCESS"
    );

    return {
        range: {
            from: range.from,
            to: range.to,
            timezone: TIMEZONE
        },
        totals: {
            payments: total,
            settledCount: settled?.count || 0,
            settledAmount: round(settled?.amount),
            byStatus: byStatus.map((row) => ({
                status: row._id,
                count: row.count,
                amount: round(row.amount)
            }))
        },
        pagination: pageMeta(safePage, safeLimit, total),
        rows: payments.map((payment) => ({
            paymentId: payment._id,
            createdAt: payment.createdAt,
            orderNumber: payment.order?.orderNumber || null,
            orderStatus: payment.order?.orderStatus || null,
            customer: payment.user?.name || null,
            email: payment.user?.email || null,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            status: payment.status,
            transactionId: payment.transactionId || null,
            failureReason: payment.failureReason || null
        }))
    };
};
