import mongoose from "mongoose";
import Wishlist from "../models/wishlist.model.js";

export const addToWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const existingWishlist = await Wishlist.findOne({
            user: userId,
            product: productId
        });

        if (existingWishlist) {
            return res.status(409).json({
                success: false,
                message: "Product already exists in wishlist"
            });
        }

        const wishlist = await Wishlist.create({
            user: userId,
            product: productId
        });

        return res.status(201).json({
            success: true,
            message: "Product added to wishlist",
            data: wishlist
        });

    } catch (error) {
        console.error("Add wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add product to wishlist"
        });
    }
};


export const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const wishlist = await Wishlist.findOneAndDelete({
            user: userId,
            product: productId
        });

        if (!wishlist) {
            return res.status(404).json({
                success: false,
                message: "Product not found in wishlist"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product removed from wishlist"
        });

    } catch (error) {
        console.error("Remove wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to remove product from wishlist"
        });
    }
};


export const getWishlist = async (req, res) => {
    try {
        const userId = req.user._id;

        const wishlist = await Wishlist.find({
            user: userId
        })
            .populate("product")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: wishlist.length,
            data: wishlist
        });

    } catch (error) {
        console.error("Get wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to get wishlist"
        });
    }
};


export const toggleWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const existingWishlist = await Wishlist.findOne({
            user: userId,
            product: productId
        });

        if (existingWishlist) {
            await Wishlist.findByIdAndDelete(existingWishlist._id);

            return res.status(200).json({
                success: true,
                message: "Product removed from wishlist",
                isWishlisted: false
            });
        }

        await Wishlist.create({
            user: userId,
            product: productId
        });

        return res.status(201).json({
            success: true,
            message: "Product added to wishlist",
            isWishlisted: true
        });

    } catch (error) {
        console.error("Toggle wishlist error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update wishlist"
        });
    }
};