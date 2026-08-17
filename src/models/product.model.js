import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },

        sku: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true
        },

        description: {
            type: String,
            trim: true
        },

        shortDescription: {
            type: String,
            trim: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        discountPrice: {
            type: Number,
            default: null,
            min: 0
        },

        stock: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        images: [
            {
                type: String
            }
        ],

        brand: {
            type: String,
            trim: true
        },

        weight: {
            type: Number,
            default: null
        },

        material: {
            type: String,
            trim: true
        },

        color: {
            type: String,
            trim: true
        },

        status: {
            type: String,
            enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
            default: "DRAFT"
        },

        isFeatured: {
            type: Boolean,
            default: false
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

const Product = mongoose.model("Product", productSchema);

export default Product;