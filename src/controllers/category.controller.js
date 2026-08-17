import {
    createCategoryService,
    getAllCategoriesService,
    getCategoryByIdService,
    updateCategoryService,
    deleteCategoryService
} from "../services/category.service.js";

export const createCategory = async (req, res, next) => {
    try {
        const category = await createCategoryService(req.body);

        res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: category
        });
    } catch (error) {
        next(error);
    }
};

export const getAllCategories = async (req, res, next) => {
    try {
        const categories = await getAllCategoriesService();

        res.status(200).json({
            success: true,
            data: categories
        });
    } catch (error) {
        next(error);
    }
};

export const getCategoryById = async (req, res, next) => {
    try {
        const category = await getCategoryByIdService(req.params.id);

        res.status(200).json({
            success: true,
            data: category
        });
    } catch (error) {
        next(error);
    }
};

export const updateCategory = async (req, res, next) => {
    try {
        const category = await updateCategoryService(
            req.params.id,
            req.body
        );

        res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: category
        });
    } catch (error) {
        next(error);
    }
};

export const deleteCategory = async (req, res, next) => {
    try {
        await deleteCategoryService(req.params.id);

        res.status(200).json({
            success: true,
            message: "Category deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};