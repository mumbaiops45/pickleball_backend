import Category from "../models/category.model.js";

export const createCategoryService = async (data) => {
    const existingCategory = await Category.findOne({
        name: data.name
    });

    if (existingCategory) {
        throw new Error("Category already exists");
    }

    const category = await Category.create(data);

    return category;
};

export const getAllCategoriesService = async () => {
    const categories = await Category.find()
        .sort({ createdAt: -1 });

    return categories;
};

export const getCategoryByIdService = async (id) => {
    const category = await Category.findById(id);

    if (!category) {
        throw new Error("Category not found");
    }

    return category;
};

export const updateCategoryService = async (id, data) => {
    const category = await Category.findByIdAndUpdate(
        id,
        data,
        {
            new: true,
            runValidators: true
        }
    );

    if (!category) {
        throw new Error("Category not found");
    }

    return category;
};

export const deleteCategoryService = async (id) => {
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
        throw new Error("Category not found");
    }

    return category;
};