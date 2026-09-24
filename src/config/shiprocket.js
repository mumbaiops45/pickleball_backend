/**
 * Thin client for the Shiprocket external API.
 *
 * Shiprocket authenticates with the email and password of an API
 * user (Settings -> API -> Create an API user in the Shiprocket
 * panel), which buys a bearer token valid for 10 days. The token is
 * cached in memory and re-fetched on expiry or on a 401.
 *
 * Every function here is optional plumbing: when the credentials are
 * not set the integration is simply off and orders can still be
 * moved through their statuses by an admin by hand.
 */
const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

// Shiprocket says 10 days; refresh a day early.
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;

let cachedToken = null;
let cachedUntil = 0;

export const isShiprocketConfigured = () =>
    Boolean(
        process.env.SHIPROCKET_EMAIL &&
        process.env.SHIPROCKET_PASSWORD
    );

export const isAutoShipEnabled = () =>
    isShiprocketConfigured() &&
    process.env.SHIPROCKET_AUTO_SHIP === "true";

const shiprocketError = (message, statusCode = 502) => {
    const error = new Error(`Shiprocket: ${message}`);
    error.statusCode = statusCode;
    return error;
};

// Shiprocket reports validation problems as { errors: { field: [..] } }.
const describe = (body, fallback) => {
    if (!body || typeof body !== "object") {
        return fallback;
    }

    if (body.errors && typeof body.errors === "object") {
        const first = Object.values(body.errors).flat()[0];

        if (first) {
            return String(first);
        }
    }

    return body.message || fallback;
};

const login = async () => {
    if (!isShiprocketConfigured()) {
        throw shiprocketError("credentials are not configured", 503);
    }

    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: process.env.SHIPROCKET_EMAIL,
            password: process.env.SHIPROCKET_PASSWORD
        })
    });

    const body = await response.json().catch(() => null);

    if (!response.ok || !body?.token) {
        throw shiprocketError(describe(body, "login failed"));
    }

    cachedToken = body.token;
    cachedUntil = Date.now() + TOKEN_TTL_MS;

    return cachedToken;
};

const getToken = async () => {
    if (cachedToken && Date.now() < cachedUntil) {
        return cachedToken;
    }

    return login();
};

const request = async (method, path, payload, retried = false) => {
    const token = await getToken();

    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: payload === undefined ? undefined : JSON.stringify(payload)
    });

    // a token revoked early (password change) — log in once more
    if (response.status === 401 && !retried) {
        cachedToken = null;
        return request(method, path, payload, true);
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
        throw shiprocketError(
            describe(body, `request failed (${response.status})`)
        );
    }

    return body;
};

const numberFromEnv = (key, fallback) => {
    const value = Number(process.env[key]);

    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const pad = (value) => String(value).padStart(2, "0");

// "2026-09-24 14:05", the format the adhoc route insists on
const shiprocketDate = (date) => {
    const d = new Date(date);

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const splitName = (fullName = "") => {
    const parts = String(fullName).trim().split(/\s+/);

    return {
        first: parts[0] || "Customer",
        last: parts.slice(1).join(" ")
    };
};

/**
 * POST /orders/create/adhoc. `order` must have `user` populated with
 * at least `email`. Returns { order_id, shipment_id, ... }.
 */
export const createShiprocketOrder = async (order) => {
    const address = order.shippingAddress;
    const { first, last } = splitName(address.fullName);

    return request("POST", "/orders/create/adhoc", {
        order_id: order.orderNumber,
        order_date: shiprocketDate(order.createdAt || Date.now()),
        pickup_location:
            process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",

        billing_customer_name: first,
        billing_last_name: last,
        billing_address: address.addressLine1,
        billing_address_2: address.addressLine2 || "",
        billing_city: address.city,
        billing_pincode: address.pincode,
        billing_state: address.state,
        billing_country: address.country || "India",
        billing_email: order.user?.email || "",
        billing_phone: address.phone,
        shipping_is_billing: true,

        order_items: order.items.map((item) => ({
            name: item.name,
            sku: String(item.product),
            units: item.quantity,
            selling_price: item.price,
            discount: 0,
            tax: 0
        })),

        payment_method:
            order.paymentMethod === "COD" ? "COD" : "Prepaid",
        shipping_charges: order.shippingCharge || 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: order.discount || 0,
        sub_total: order.subtotal,

        // one parcel per order; tune the defaults in .env
        length: numberFromEnv("SHIPROCKET_PACKAGE_LENGTH", 20),
        breadth: numberFromEnv("SHIPROCKET_PACKAGE_BREADTH", 15),
        height: numberFromEnv("SHIPROCKET_PACKAGE_HEIGHT", 10),
        weight: numberFromEnv("SHIPROCKET_PACKAGE_WEIGHT", 0.5)
    });
};

/**
 * POST /courier/assign/awb. Without a courier id Shiprocket picks the
 * recommended courier for the pincode.
 */
export const assignAwb = async (shipmentId, courierId) => {
    const body = await request("POST", "/courier/assign/awb", {
        shipment_id: shipmentId,
        ...(courierId ? { courier_id: courierId } : {})
    });

    const data = body?.response?.data;

    if (body?.awb_assign_status !== 1 || !data?.awb_code) {
        throw shiprocketError(
            data?.awb_assign_error ||
            body?.message ||
            "no courier could be assigned"
        );
    }

    return {
        awbCode: String(data.awb_code),
        courierName: data.courier_name || null
    };
};

export const generatePickup = (shipmentId) =>
    request("POST", "/courier/generate/pickup", {
        shipment_id: [shipmentId]
    });

export const trackAwb = (awbCode) =>
    request(
        "GET",
        `/courier/track/awb/${encodeURIComponent(awbCode)}`
    );

export const cancelShiprocketOrder = (shiprocketOrderId) =>
    request("POST", "/orders/cancel", {
        ids: [Number(shiprocketOrderId) || shiprocketOrderId]
    });

export const publicTrackingUrl = (awbCode) =>
    awbCode
        ? `https://shiprocket.co/tracking/${encodeURIComponent(awbCode)}`
        : null;
