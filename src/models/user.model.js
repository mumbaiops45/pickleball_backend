import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true
        },

        email: {
            type: String,
            lowercase: true,
            trim: true,
            unique: true,
            sparse: true
        },

        phone: {
            type: String,
            trim: true,
            unique: true,
            sparse: true
        },

        password: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["CUSTOMER", "ADMIN"],
            default: "CUSTOMER"
        },

        isBlocked: {
            type: Boolean,
            default: false
        },

        lastLoginAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

const User = mongoose.model("User", userSchema);

export default User;