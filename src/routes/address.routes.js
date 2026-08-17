import express from "express";

import {
    createAddress,
    getAllAddresses,
    getAddressById,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} from "../controllers/address.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", createAddress);

router.get("/", getAllAddresses);

router.get("/:id", getAddressById);

router.put("/:id", updateAddress);

router.delete("/:id", deleteAddress);

router.patch("/:id/default", setDefaultAddress);

export default router;