import crypto from "crypto";
import Razorpay from "razorpay";

/**
 * dotenv.config() runs in server.js after this module is
 * imported, so the client is built lazily on first use
 * instead of at module-evaluation time.
 */
let razorpayInstance = null;

const requireEnv = (key) => {
    const value = process.env[key];

    if (!value) {
        throw new Error(
            `${key} is missing. Razorpay is not configured`
        );
    }

    return value;
};

export const getRazorpayKeyId = () =>
    requireEnv("RAZORPAY_KEY_ID");

export const getRazorpayInstance = () => {
    if (!razorpayInstance) {
        razorpayInstance = new Razorpay({
            key_id: requireEnv("RAZORPAY_KEY_ID"),
            key_secret: requireEnv("RAZORPAY_KEY_SECRET")
        });
    }

    return razorpayInstance;
};

/**
 * Razorpay signs the checkout response with the API secret and
 * webhooks with a separate webhook secret. Both are plain
 * HMAC-SHA256 hex digests, compared in constant time.
 */
const safeCompare = (expected, received) => {
    if (
        typeof received !== "string" ||
        expected.length !== received.length
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(received)
    );
};

export const verifyCheckoutSignature = ({
    razorpayOrderId,
    razorpayPaymentId,
    signature
}) => {
    const expected = crypto
        .createHmac(
            "sha256",
            requireEnv("RAZORPAY_KEY_SECRET")
        )
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

    return safeCompare(expected, signature);
};

export const verifyWebhookSignature = ({
    rawBody,
    signature
}) => {
    const expected = crypto
        .createHmac(
            "sha256",
            requireEnv("RAZORPAY_WEBHOOK_SECRET")
        )
        .update(rawBody)
        .digest("hex");

    return safeCompare(expected, signature);
};

// Razorpay works in the smallest currency unit (paise for INR).
export const toSmallestUnit = (amount) =>
    Math.round(Number(amount) * 100);

export const fromSmallestUnit = (amount) =>
    Number(amount) / 100;
