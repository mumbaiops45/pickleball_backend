import {
    createAddressService,
    getAllAddressesService,
    getAddressByIdService,
    updateAddressService,
    deleteAddressService,
    setDefaultAddressService
} from "../services/address.service.js";

export const createAddress = async (req, res, next) => {
    try {
        const address = await createAddressService(
            req.user._id,
            req.body
        );

        res.status(201).json({
            success: true,
            message: "Address created successfully",
            data: address
        });
    } catch (error) {
        next(error);
    }
};

export const getAllAddresses = async (req, res, next) => {
    try {
        const addresses = await getAllAddressesService(
            req.user._id
        );

        res.status(200).json({
            success: true,
            data: addresses
        });
    } catch (error) {
        next(error);
    }
};

export const getAddressById = async (req, res, next) => {
    try {
        const address = await getAddressByIdService(
            req.user._id,
            req.params.id
        );

        res.status(200).json({
            success: true,
            data: address
        });
    } catch (error) {
        next(error);
    }
};

export const updateAddress = async (req, res, next) => {
    try {
        const address = await updateAddressService(
            req.user._id,
            req.params.id,
            req.body
        );

        res.status(200).json({
            success: true,
            message: "Address updated successfully",
            data: address
        });
    } catch (error) {
        next(error);
    }
};

export const deleteAddress = async (req, res, next) => {
    try {
        await deleteAddressService(
            req.user._id,
            req.params.id
        );

        res.status(200).json({
            success: true,
            message: "Address deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

export const setDefaultAddress = async (req, res, next) => {
    try {
        const address = await setDefaultAddressService(
            req.user._id,
            req.params.id
        );

        res.status(200).json({
            success: true,
            message: "Default address updated successfully",
            data: address
        });
    } catch (error) {
        next(error);
    }
};