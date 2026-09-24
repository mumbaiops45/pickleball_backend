/**
 * Store-wide money rules. The storefront shows the same numbers in
 * the cart (free shipping from Rs 2499, otherwise Rs 99), so the
 * defaults match it; override per environment if they change.
 *
 * Read lazily: dotenv.config() runs after modules are imported.
 */
const numberFromEnv = (key, fallback) => {
    const value = Number(process.env[key]);

    return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export const getShippingCharge = (subtotal) => {
    const threshold = numberFromEnv("FREE_SHIPPING_THRESHOLD", 2499);
    const flat = numberFromEnv("SHIPPING_FLAT", 99);

    return subtotal === 0 || subtotal >= threshold ? 0 : flat;
};
