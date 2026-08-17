import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const register = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!email && !phone) {
            return res.status(400).json({
                success: false,
                message: "Email or phone is required"
            });
        }
        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password is required"
            });
        }

        const existingUser = await User.findOne({
            $or: [
                ...(email ? [{ email: email.toLowerCase() }] : []),
                ...(phone ? [{ phone }] : [])
            ]
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email: email ? email.toLowerCase() : undefined,
            phone,
            password: hashedPassword,
            role: "CUSTOMER"
        });

        return res.status(201).json({
            success: true,
            message: "Customer registered successfully",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, phone, password } = req.body;

        if (!email && !phone) {
            return res.status(400).json({
                success: false,
                message: "Email or phone is required"
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password is required"
            });
        }

        const user = await User.findOne(
            email ? { email: email.toLowerCase() } : { phone }
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: "User is blocked"
            });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        user.lastLoginAt = new Date();
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role
                }
            }
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
};

export const sendOtp = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });
        }

        // Check if customer exists
        const user = await User.findOne({ phone });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Phone number is not registered"
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: "User is blocked"
            });
        }

        // TEMPORARY OTP
        const otp = "123456";

        console.log(`OTP for ${phone}: ${otp}`);

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully"
        });

    } catch (error) {
        console.error("Send OTP error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to send OTP"
        });
    }
};


export const verifyOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({
                success: false,
                message: "Phone number and OTP are required"
            });
        }

        // TEMPORARY OTP
        if (otp !== "123456") {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully"
        });

    } catch (error) {
        console.error("Verify OTP error:", error);

        return res.status(500).json({
            success: false,
            message: "OTP verification failed"
        });
    }
};