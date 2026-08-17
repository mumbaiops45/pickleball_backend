import Address from "../models/address.model.js";

export const createAddressService = async (userId, data) => {
    const {
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        country,
        addressType,
        isDefault
    } = data;

    if (
        !fullName ||
        !phone ||
        !addressLine1 ||
        !city ||
        !state ||
        !pincode
    ) {
        throw new Error("Required address fields are missing");
    }

    if (isDefault === true) {
        await Address.updateMany(
            { user: userId },
            { $set: { isDefault: false } }
        );
    }

    const address = await Address.create({
        user: userId,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        country: country || "India",
        addressType: addressType || "HOME",
        isDefault: isDefault || false
    });

    return address;
};

export const getAllAddressesService = async (userId) => {
    const addresses = await Address.find({
        user: userId
    }).sort({
        isDefault: -1,
        createdAt: -1
    });

    return addresses;
};

export const getAddressByIdService = async (
    userId,
    addressId
) => {
    const address = await Address.findOne({
        _id: addressId,
        user: userId
    });

    if (!address) {
        throw new Error("Address not found");
    }

    return address;
};

export const updateAddressService = async (
    userId,
    addressId,
    data
) => {
    const address = await Address.findOne({
        _id: addressId,
        user: userId
    });

    if (!address) {
        throw new Error("Address not found");
    }

    if (data.isDefault === true) {
        await Address.updateMany(
            {
                user: userId,
                _id: { $ne: addressId }
            },
            {
                $set: { isDefault: false }
            }
        );
    }

    const updatedAddress =
        await Address.findOneAndUpdate(
            {
                _id: addressId,
                user: userId
            },
            data,
            {
                new: true,
                runValidators: true
            }
        );

    return updatedAddress;
};

export const deleteAddressService = async (
    userId,
    addressId
) => {
    const address = await Address.findOneAndDelete({
        _id: addressId,
        user: userId
    });

    if (!address) {
        throw new Error("Address not found");
    }

    return address;
};

export const setDefaultAddressService = async (
    userId,
    addressId
) => {
    const address = await Address.findOne({
        _id: addressId,
        user: userId
    });

    if (!address) {
        throw new Error("Address not found");
    }

    await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } }
    );

    address.isDefault = true;

    await address.save();

    return address;
};