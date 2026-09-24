/**
 * Inserts the pickleballs the storefront sells but Mongo has never held a row for.
 *
 * `GET /products` is the whole shop — `loadCatalogue` returns the API rows and
 * nothing else once the API answers, so a product with no row here simply does
 * not exist to a shopper.
 *
 * The store sells balls only. Paddles, shoes, apparel and bags are never
 * seeded: a row in any other category is skipped even if it appears in the
 * JSON, so regenerating the file from the full catalogue cannot bring them back.
 *
 * Rows come from scripts/missing-products.json, generated out of the
 * storefront's own data.js so names, prices, colourways, highlights and specs
 * are not retyped. Regenerate that file if the catalogue changes.
 *
 *   node scripts/seed-missing.mjs            # dry run — prints, writes nothing
 *   node scripts/seed-missing.mjs --apply    # inserts
 *
 * Safe to re-run: a slug already present is reported and skipped, never
 * overwritten — an admin may have edited it since.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "../src/models/product.model.js";
import Category from "../src/models/category.model.js";

dotenv.config();

const here = dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes("--apply");

if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Check .env.");
    process.exit(1);
}

const rows = JSON.parse(
    await readFile(join(here, "missing-products.json"), "utf8")
);

await mongoose.connect(process.env.MONGO_URI);

// One lookup for the whole run: `category` is a required ObjectId ref, and the
// seed file carries the category by name.
const categories = await Category.find().select("_id name");
const categoryId = new Map(categories.map((c) => [c.name, c._id]));

// the only categories this store sells
const BALL_CATEGORIES = new Set(["Ball", "Balls"]);

const counts = { inserted: 0, exists: 0, blocked: 0, notBall: 0 };

for (const row of rows) {
    const { categoryName, ...doc } = row;

    if (!BALL_CATEGORIES.has(categoryName)) {
        counts.notBall += 1;
        console.log(`- ${doc.slug.padEnd(28)} ${categoryName} — not a ball, skipped`);
        continue;
    }

    const existing = await Product.findOne({
        $or: [{ slug: doc.slug }, { sku: doc.sku }]
    }).select("_id slug sku");

    if (existing) {
        counts.exists += 1;
        const clash = existing.slug === doc.slug ? "slug" : `sku ${doc.sku}`;
        console.log(`= ${doc.slug.padEnd(28)} already present (${clash}) — skipped`);
        continue;
    }

    const category = categoryId.get(categoryName);

    if (!category) {
        counts.blocked += 1;
        console.log(
            `! ${doc.slug.padEnd(28)} BLOCKED — no category named "${categoryName}"`
        );
        continue;
    }

    if (apply) {
        await Product.create({ ...doc, category });
    }

    counts.inserted += 1;
    const price = doc.discountPrice
        ? `${doc.discountPrice} (was ${doc.price})`
        : `${doc.price}`;
    console.log(
        `${apply ? "+" : "~"} ${doc.slug.padEnd(28)} ${categoryName.padEnd(8)} ${price}`
    );
}

console.log(
    `\n${apply ? "Inserted" : "Would insert"} ${counts.inserted} · ` +
    `${counts.exists} already present · ${counts.blocked} blocked · ` +
    `${counts.notBall} non-ball skipped`
);

if (!apply) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
}

await mongoose.disconnect();
