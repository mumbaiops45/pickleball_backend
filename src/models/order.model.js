import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        name: {
            type: String,
            required: true
        },

        image: {
            type: String,
            default: null
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        total: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        _id: false
    }
);

const shippingAddressSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true
        },

        phone: {
            type: String,
            required: true
        },

        addressLine1: {
            type: String,
            required: true
        },

        addressLine2: {
            type: String,
            default: ""
        },

        city: {
            type: String,
            required: true
        },

        state: {
            type: String,
            required: true
        },

        pincode: {
            type: String,
            required: true
        },

        country: {
            type: String,
            default: "India"
        }
    },
    {
        _id: false
    }
);

const statusEventSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            required: true
        },

        note: {
            type: String,
            default: ""
        },

        at: {
            type: Date,
            default: Date.now
        }
    },
    {
        _id: false
    }
);

// One courier scan, as Shiprocket reports it.
const trackingEventSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            default: ""
        },

        activity: {
            type: String,
            default: ""
        },

        location: {
            type: String,
            default: ""
        },

        at: {
            type: Date,
            default: null
        }
    },
    {
        _id: false
    }
);

/**
 * Courier details. Filled by the Shiprocket integration, or by an
 * admin by hand for a parcel sent some other way.
 */
const shipmentSchema = new mongoose.Schema(
    {
        provider: {
            type: String,
            default: null
        },

        shiprocketOrderId: {
            type: String,
            default: null
        },

        shipmentId: {
            type: String,
            default: null
        },

        awbCode: {
            type: String,
            default: null
        },

        courierName: {
            type: String,
            default: null
        },

        trackingUrl: {
            type: String,
            default: null
        },

        // the courier's own wording, e.g. "OUT FOR DELIVERY"
        currentStatus: {
            type: String,
            default: null
        },

        estimatedDelivery: {
            type: Date,
            default: null
        },

        events: {
            type: [trackingEventSchema],
            default: []
        },

        lastSyncedAt: {
            type: Date,
            default: null
        },

        lastError: {
            type: String,
            default: null
        }
    },
    {
        _id: false
    }
);

const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            unique: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: (items) => items.length > 0,
                message: "Order must contain at least one item"
            }
        },

        shippingAddress: {
            type: shippingAddressSchema,
            required: true
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0
        },

        shippingCharge: {
            type: Number,
            default: 0,
            min: 0
        },

        discount: {
            type: Number,
            default: 0,
            min: 0
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },

        paymentMethod: {
            type: String,
            enum: ["COD", "ONLINE"],
            required: true
        },

        paymentStatus: {
            type: String,
            enum: [
                "PENDING",
                "PAID",
                "FAILED",
                "REFUNDED"
            ],
            default: "PENDING"
        },

        orderStatus: {
            type: String,
            enum: [
                "PENDING",
                "CONFIRMED",
                "PROCESSING",
                "SHIPPED",
                "DELIVERED",
                "CANCELLED"
            ],
            default: "PENDING"
        },

        paymentId: {
            type: String,
            default: null
        },

        cancelledAt: {
            type: Date,
            default: null
        },

        cancellationReason: {
            type: String,
            default: null
        },

        shippedAt: {
            type: Date,
            default: null
        },

        deliveredAt: {
            type: Date,
            default: null
        },

        // Every orderStatus change, oldest first: the customer's
        // tracking timeline is drawn from this.
        statusHistory: {
            type: [statusEventSchema],
            default: []
        },

        shipment: {
            type: shipmentSchema,
            default: () => ({})
        }
    },
    {
        timestamps: true
    }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;