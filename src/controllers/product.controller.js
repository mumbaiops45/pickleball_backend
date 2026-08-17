import {
    createProductService,
    getAllProductsService,
    getProductByIdService,
    updateProductService,
    deleteProductService
} from "../services/product.service.js";

export const createProduct = async (req, res, next) => {
    try {
        const product = await createProductService(req.body);

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product
        });
    } catch (error) {
        next(error);
    }
};

export const getAllProducts = async (req, res, next) => {
    try {
        const products = await getAllProductsService();

        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        next(error);
    }
};

export const getProductById = async (req, res, next) => {
    try {
        const product = await getProductByIdService(
            req.params.id
        );

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        next(error);
    }
};

export const updateProduct = async (req, res, next) => {
    try {
        const product = await updateProductService(
            req.params.id,
            req.body
        );

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: product
        });
    } catch (error) {
        next(error);
    }
};

export const deleteProduct = async (req, res, next) => {
    try {
        await deleteProductService(req.params.id);

        res.status(200).json({
            success: true,
            message: "Product deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};