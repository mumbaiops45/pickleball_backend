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
        },

        /* ---------------------------------------------- merchandising */

        // Free text, not an enum — marketing keeps inventing these.
        // "Best seller", "New", "Tournament", "Club pack"…
        badge: {
            type: String,
            trim: true,
            default: null
        },

        // "Beginner" | "Intermediate" | "Advanced" | "All levels"
        skill: {
            type: String,
            trim: true,
            default: null
        },

        // "Men's" | "Kid's" — shoes only, drives the shop sidebar.
        type: {
            type: String,
            trim: true,
            default: null
        },

        /* ------------- social proof, until a Review model exists ----- */

        rating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },

        reviewCount: {
            type: Number,
            min: 0,
            default: 0
        },

        /* ------------------------------------------ selectable options */

        // Swatches on the product page. Display only: colour and option
        // share one stock pool, so there is still a single sku/stock.
        colorways: [
            {
                _id: false,

                name: {
                    type: String,
                    required: true,
                    trim: true
                },

                hex: {
                    type: String,
                    required: true,
                    trim: true
                }
            }
        ],

        // "Grip size" | "US size" | "Size" | "Pack size" | "Capacity"
        optionLabel: {
            type: String,
            trim: true,
            default: null
        },

        // ["4in", "4 1/8in", "4 1/4in"]
        options: [
            {
                type: String,
                trim: true
            }
        ],

        /* ------------------------------------------------------ content */

        highlights: [
            {
                type: String,
                trim: true
            }
        ],

        // Label/value pairs rather than fixed columns: a paddle needs
        // Face/Core/Shape, a shoe needs Drop/Outsole/Fit, a bag needs
        // Volume/Paddle capacity.
        specs: [
            {
                _id: false,

                label: {
                    type: String,
                    required: true,
                    trim: true
                },

                value: {
                    type: String,
                    required: true,
                    trim: true
                }
            }
        ]
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

/**
 * The storefront's price pair, resolved here so no client can invert it:
 * `price` on the model is the list price and `discountPrice` the lower
 * amount actually charged, which is the opposite way round from how a
 * product page reads them.
 */
productSchema.virtual("effectivePrice").get(function () {
    return this.discountPrice ?? this.price;
});

// The struck-through number, or null when the product is not on offer.
productSchema.virtual("compareAt").get(function () {
    return this.discountPrice ? this.price : null;
});

productSchema.virtual("swatches").get(function () {
    return (this.colorways || []).map((colorway) => colorway.hex);
});

const Product = mongoose.model("Product", productSchema);

export default Product;