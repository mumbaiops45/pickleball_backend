import express from "express";

import {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} from "../controllers/category.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";
import adminMiddleware from "../middlewares/admin.middleware.js";

const router = express.Router();

/**
 * Same split as the product routes: the storefront and the catalogue export
 * script both read categories anonymously, while creating, renaming and
 * deleting one is an admin action. Deleting a category orphans every product
 * pointing at it, so this is the more damaging of the two routers to leave open.
 */

router.get("/", getAllCategories);

router.get("/:id", getCategoryById);

router.post("/", authMiddleware, adminMiddleware, createCategory);

router.put("/:id", authMiddleware, adminMiddleware, updateCategory);

router.delete("/:id", authMiddleware, adminMiddleware, deleteCategory);

export default router;
