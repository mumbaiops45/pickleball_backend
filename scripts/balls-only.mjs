/**
 * Makes the catalogue pickleballs only.
 *
 *  - every product outside the Ball category (paddles, shoes, apparel,
 *    bags) is archived: status ARCHIVED, isActive false
 *  - every ball is published: status PUBLISHED, isActive true
 *
 * Nothing is deleted. Carts, wishlists and past orders reference products
 * by _id, so an archived row stays in place for them; it just leaves the
 * shop. To bring one back, set it to PUBLISHED and active in the admin.
 *
 *   node scripts/balls-only.mjs            # dry run — prints, writes nothing
 *   node scripts/balls-only.mjs --apply    # performs the update
 *
 * Safe to re-run: rows already in the right state are left alone.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../src/models/product.model.js";
import Category from "../src/models/category.model.js";

dotenv.config();

const apply = process.argv.includes("--apply");

// the only categories this store sells
const BALL_CATEGORIES = new Set(["ball", "balls"]);

if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Check .env.");
    process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const categories = await Category.find().select("_id name");
const ballIds = new Set(
    categories
        .filter((c) => BALL_CATEGORIES.has(String(c.name).trim().toLowerCase()))
        .map((c) => String(c._id))
);

if (ballIds.size === 0) {
    console.error('No category named "Ball" or "Balls" — refusing to archive everything.');
    await mongoose.disconnect();
    process.exit(1);
}

const categoryName = new Map(categories.map((c) => [String(c._id), c.name]));

const products = await Product.find().select("_id name slug category status isActive");

const counts = { archived: 0, published: 0, unchanged: 0 };

for (const product of products) {
    const isBall = ballIds.has(String(product.category));
    const target = isBall
        ? { status: "PUBLISHED", isActive: true }
        : { status: "ARCHIVED", isActive: false };

    const label = `${String(product.slug).padEnd(34)} ${String(categoryName.get(String(product.category)) ?? "?").padEnd(8)}`;

    if (product.status === target.status && product.isActive === target.isActive) {
        counts.unchanged += 1;
        continue;
    }

    const from = `${product.status}/${product.isActive ? "active" : "inactive"}`;
    const to = `${target.status}/${target.isActive ? "active" : "inactive"}`;
    console.log(`${isBall ? "+" : "-"} ${label} ${from} -> ${to}`);

    if (apply) {
        await Product.updateOne({ _id: product._id }, { $set: target });
    }

    counts[isBall ? "published" : "archived"] += 1;
}

console.log(
    `\n${apply ? "Done" : "Would change"}: ${counts.published} balls published · ` +
    `${counts.archived} non-ball products archived · ${counts.unchanged} already correct`
);

if (!apply) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
}

await mongoose.disconnect();
