import express from "express";

import {
    register,
    login,
    sendOtp,
    verifyOtp,
    getUsers,
    getUserById,
    updateUser,
    deleteUser
} from "../controllers/auth.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";
import adminMiddleware from "../middlewares/admin.middleware.js";

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

// OTP routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

// User management
router.get(
    "/users",
    authMiddleware,
    adminMiddleware,
    getUsers
);

router.get(
    "/users/:id",
    authMiddleware,
    adminMiddleware,
    getUserById
);

router.put(
    "/users/:id",
    authMiddleware,
    adminMiddleware,
    updateUser
);

router.delete(
    "/users/:id",
    authMiddleware,
    adminMiddleware,
    deleteUser
);

export default router;