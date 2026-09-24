import express from "express";

import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct
} from "../controllers/product.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";
import adminMiddleware from "../middlewares/admin.middleware.js";

const router = express.Router();

/**
 * Reads stay public — the storefront fetches the catalogue before anyone has
 * signed in. Writes are admin only: these routes shipped with no middleware at
 * all, which left create, update and delete open to anyone who could reach the
 * host. Only the admin panel calls them, and it already sends a bearer token
 * on every request, so nothing legitimate loses access here.
 */

router.get("/", getAllProducts);

router.get("/:id", getProductById);

router.post("/", authMiddleware, adminMiddleware, createProduct);

router.put("/:id", authMiddleware, adminMiddleware, updateProduct);

router.delete("/:id", authMiddleware, adminMiddleware, deleteProduct);

export default router;
