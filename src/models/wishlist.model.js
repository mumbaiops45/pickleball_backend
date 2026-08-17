import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Same product cannot be added twice by the same user
wishlistSchema.index(
    { user: 1, product: 1 },
    { unique: true }
);

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

export default Wishlist;