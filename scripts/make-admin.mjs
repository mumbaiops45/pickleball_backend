/**
 * Promote a user to ADMIN.
 *
 * Usage: node scripts/make-admin.mjs admin@gmail.com
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/user.model.js";

dotenv.config();

const email = process.argv[2];

if (!email) {
    console.error("Usage: node scripts/make-admin.mjs <email>");
    process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { $set: { role: "ADMIN" } },
    { new: true }
).select("-password");

if (!user) {
    console.error(`No user found with email ${email}`);
    await mongoose.disconnect();
    process.exit(1);
}

console.log("Updated:", {
    id: user._id.toString(),
    email: user.email,
    role: user.role
});

await mongoose.disconnect();
