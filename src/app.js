import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import addressRoutes from "./routes/address.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import reportRoutes from "./routes/report.routes.js";
import {
    notFoundHandler,
    errorHandler
} from "./middlewares/error.middleware.js";
const app = express();

const DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://pickleball-admin-two.vercel.app",
    "https://pickleball-amber.vercel.app"
];

// Read lazily: dotenv.config() runs after this module is imported,
// so process.env is not populated at module-evaluation time.
const getAllowedOrigins = () => {
    const fromEnv = (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv])];
};

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow non-browser clients (curl, Postman, server-to-server)
            if (!origin) {
                return callback(null, true);
            }

            if (getAllowedOrigins().includes(origin)) {
                return callback(null, true);
            }

            console.warn(`CORS blocked origin: ${origin}`);

            return callback(null, false);
        },
        credentials: true
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.use("/api/auth", authRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Pickleball Ecommerce API is running"
    });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;