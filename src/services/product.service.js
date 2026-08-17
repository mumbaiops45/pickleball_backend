import Product from "../models/product.model.js";
import Category from "../models/category.model.js";

export const createProductService = async (data) => {
    const existingProduct = await Product.findOne({
        $or: [
            { sku: data.sku },
            { slug: data.slug }
        ]
    });

    if (existingProduct) {
        throw new Error("Product with SKU or slug already exists");
    }

    const category = await Category.findById(data.category);

    if (!category) {
        throw new Error("Category not found");
    }

    const product = await Product.create(data);

    return product;
};

export const getAllProductsService = async () => {
    const products = await Product.find()
        .populate("category", "name")
        .sort({ createdAt: -1 });

    return products;
};

export const getProductByIdService = async (id) => {
    const product = await Product.findById(id)
        .populate("category", "name");

    if (!product) {
        throw new Error("Product not found");
    }

    return product;
};

export const updateProductService = async (id, data) => {
    const product = await Product.findById(id);

    if (!product) {
        throw new Error("Product not found");
    }

    if (data.category) {
        const category = await Category.findById(data.category);

        if (!category) {
            throw new Error("Category not found");
        }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        id,
        data,
        {
            new: true,
            runValidators: true
        }
    ).populate("category", "name");

    return updatedProduct;
};

export const deleteProductService = async (id) => {
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
        throw new Error("Product not found");
    }

    return product;
};