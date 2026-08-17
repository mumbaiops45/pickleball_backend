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
        }
    },
    {
        timestamps: true
    }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;