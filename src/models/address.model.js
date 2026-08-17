import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        fullName: {
            type: String,
            required: true,
            trim: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        addressLine1: {
            type: String,
            required: true,
            trim: true
        },

        addressLine2: {
            type: String,
            trim: true,
            default: ""
        },

        city: {
            type: String,
            required: true,
            trim: true
        },

        state: {
            type: String,
            required: true,
            trim: true
        },

        pincode: {
            type: String,
            required: true,
            trim: true
        },

        country: {
            type: String,
            default: "India",
            trim: true
        },

        addressType: {
            type: String,
            enum: ["HOME", "WORK", "OTHER"],
            default: "HOME"
        },

        isDefault: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

const Address = mongoose.model("Address", addressSchema);

export default Address;