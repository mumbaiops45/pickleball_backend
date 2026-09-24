/**
 * Aligns `Product.slug` with the storefront's catalogue ids.
 *
 * The collection was seeded with slugs generated from the product *name*
 * ("trueflight-outdoor-40") while the storefront resolves a product by the id
 * in its own `src/lib/data.js` ("trueflight-outdoor"). Where the two disagree
 * the frontend cannot join an API row to its local entry, so that product
 * silently loses its colourways, options, specs and artwork kind.
 *
 * Worst of these is "carbon-fiber-pickleball-paddle", which is the Apex Carbon
 * 16 — the paddle the Paddle Finder recommends and the Season Starter bundle
 * is built from. Both fail against the live API today.
 *
 * Renames happen in place with updateOne. Never delete-and-recreate: cart,
 * wishlist and order lines all reference the `_id`, which has to survive.
 *
 *   node scripts/fix-slugs.mjs            # dry run — prints, writes nothing
 *   node scripts/fix-slugs.mjs --apply    # performs the renames
 *
 * Safe to re-run. A row already carrying the target slug is reported as done
 * and skipped rather than written again.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../src/models/product.model.js";

dotenv.config();

/** Slug currently in Mongo -> the catalogue id the storefront looks for. */
const RENAME = {
    "carbon-fiber-pickleball-paddle": "apex-carbon-16",
    "flux-elite-edgeless": "flux-elite",
    "trueflight-outdoor-40": "trueflight-outdoor",
    "trueflight-indoor-26": "trueflight-indoor",
    "baseline-dry-tee": "baseline-tee",
    "kitchen-7in-shorts": "kitchen-shorts",
    "tour-duffel-40l": "tour-duffel",
    "sideline-sling": "sling-pack",
    "courtgrip-low": "court-grip-low",
    "tacky-overgrip-3-pack": "tacky-overgrip",
    "asics-solution-speed-ff-3": "asics-solution-speed-ff3",
    "asics-solution-speed-ff-3-blackout": "asics-solution-speed-ff3-black",
    "babolat-jet-tere-2-all-court": "babolat-jet-tere-2",
    "mizuno-wave-exceed-light-2": "mizuno-wave-exceed-light",
    "head-pro-40-outdoor-4-sleeve-case": "head-pro-40-case"
};

const apply = process.argv.includes("--apply");

if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Check .env.");
    process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const counts = { renamed: 0, done: 0, missing: 0, blocked: 0 };

for (const [from, to] of Object.entries(RENAME)) {
    const source = await Product.findOne({ slug: from }).select("_id name slug");

    if (!source) {
        // Either already renamed on an earlier run, or never seeded at all.
        const target = await Product.findOne({ slug: to }).select("_id");
        if (target) {
            counts.done += 1;
            console.log(`= ${to.padEnd(34)} already correct`);
        } else {
            counts.missing += 1;
            console.log(`? ${from.padEnd(34)} no such row`);
        }
        continue;
    }

    // `slug` is a unique index, so a collision would throw mid-loop. Check for
    // it first and report, rather than aborting the rest of the renames.
    const clash = await Product.findOne({
        slug: to,
        _id: { $ne: source._id }
    }).select("_id name");

    if (clash) {
        counts.blocked += 1;
        console.log(
            `! ${from.padEnd(34)} -> ${to} BLOCKED, taken by ${clash._id} (${clash.name})`
        );
        continue;
    }

    if (apply) {
        await Product.updateOne({ _id: source._id }, { $set: { slug: to } });
    }

    counts.renamed += 1;
    console.log(`${apply ? "+" : "~"} ${from.padEnd(34)} -> ${to}  (${source.name})`);
}

console.log(
    `\n${apply ? "Renamed" : "Would rename"} ${counts.renamed} · ` +
    `${counts.done} already correct · ${counts.missing} absent · ${counts.blocked} blocked`
);

if (!apply) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
}

await mongoose.disconnect();
