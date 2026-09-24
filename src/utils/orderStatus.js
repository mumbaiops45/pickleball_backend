export const ORDER_FLOW = [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED"
];

export const ORDER_STATUSES = [...ORDER_FLOW, "CANCELLED"];

const rank = (status) => ORDER_FLOW.indexOf(status);

/** True when `next` is further along the delivery flow than `current`. */
export const isForward = (current, next) =>
    rank(next) > rank(current);

/**
 * Moves an order to a new status and records it on the timeline.
 * Does not save. Returns false when nothing changed.
 */
export const applyOrderStatus = (order, status, note = "") => {
    if (order.orderStatus === status) {
        return false;
    }

    order.orderStatus = status;
    order.statusHistory.push({
        status,
        note,
        at: new Date()
    });

    if (status === "SHIPPED" && !order.shippedAt) {
        order.shippedAt = new Date();
    }

    if (status === "DELIVERED") {
        order.deliveredAt = new Date();

        // cash on delivery is collected at the door
        if (
            order.paymentMethod === "COD" &&
            order.paymentStatus === "PENDING"
        ) {
            order.paymentStatus = "PAID";
        }
    }

    return true;
};

/**
 * Courier wording -> our status. Returns null for events that
 * should not move the order (RTO, lost, cancelled shipment): those
 * are for an admin to resolve.
 */
export const statusFromCourier = (text) => {
    const value = String(text || "").toUpperCase().trim();

    if (!value) {
        return null;
    }

    if (value.includes("RTO") || value.includes("CANCEL") || value.includes("LOST")) {
        return null;
    }

    if (value.startsWith("DELIVERED")) {
        return "DELIVERED";
    }

    if (
        value.includes("PICKED UP") ||
        value.includes("IN TRANSIT") ||
        value.includes("OUT FOR DELIVERY") ||
        value.includes("SHIPPED") ||
        value.includes("REACHED") ||
        value.includes("DELAYED") ||
        value.includes("UNDELIVERED")
    ) {
        return "SHIPPED";
    }

    if (
        value.includes("AWB") ||
        value.includes("PICKUP") ||
        value.includes("MANIFEST") ||
        value.includes("READY TO SHIP")
    ) {
        return "PROCESSING";
    }

    return null;
};
