/**
 * Pushes the client's approved pickleball copy onto the two TrueFlight rows.
 *
 * The storefront lays an API row over its local catalogue entry and the API
 * wins on `description`, `highlights` and `specs` — so editing the frontend's
 * data.js alone leaves the old text on the live product page. This is the
 * other half of that change.
 *
 * It also repairs two seeding faults on these rows: TrueFlight Outdoor had the
 * badge value ("TOURNAMENT") written into `highlights`, and both rows were
 * seeded with no `colorways`, which the storefront needs for the colour picker.
 *
 *   node scripts/update-ball-copy.mjs            # dry run — prints, writes nothing
 *   node scripts/update-ball-copy.mjs --apply    # performs the update
 *
 * Matched on slug, and each row is looked up under both its current seeded slug
 * and its catalogue id, so this runs correctly before or after fix-slugs.mjs.
 * Safe to re-run.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../src/models/product.model.js";

dotenv.config();

const BALLS = [
    {
        slugs: ["trueflight-outdoor", "trueflight-outdoor-40"],
        update: {
            shortDescription: "12-ball tube · seamless rotational mold",
            description:
                "A premium-quality 40-hole rotomolded pickleball, produced using high-quality imported raw materials, ensuring exceptional durability, consistent flight, and outstanding playing performance comparable to leading international brands such as Franklin. Molded in one piece, so there is no seam to split.",
            badge: "Tournament",
            highlights: [
                "Rotomolded in one piece — no seam to split",
                "Pressed from high-quality imported raw material",
                "40 holes, outdoor tournament spec",
                "Stays round through a full league season"
            ],
            specs: [
                { label: "Type", value: "Outdoor" },
                { label: "Construction", value: "One-piece rotomolded" },
                { label: "Material", value: "Imported raw material" },
                { label: "Holes", value: "40" },
                { label: "Diameter", value: "74mm" },
                { label: "Weight", value: "26.5 g" },
                { label: "Certification", value: "AIPA approved" }
            ],
            colorways: [
                { name: "Optic", hex: "#d4ff3f" },
                { name: "Clay", hex: "#ff5c2b" }
            ],
            optionLabel: "Pack size",
            options: ["3 balls", "12 balls", "36 balls"]
        }
    },
    {
        slugs: ["trueflight-indoor", "trueflight-indoor-26"],
        update: {
            shortDescription: "6-ball sleeve · softer indoor compound",
            description:
                "The same imported raw materials and one-piece rotomold as the outdoor ball, run in a softer compound with larger holes for gym floors. Quieter off the face and easier to control on a slick surface.",
            highlights: [
                "26-hole indoor pattern",
                "Rotomolded from the same imported raw material",
                "Softer compound for gym floors",
                "Noticeably quieter off the paddle"
            ],
            specs: [
                { label: "Type", value: "Indoor" },
                { label: "Construction", value: "One-piece rotomolded" },
                { label: "Material", value: "Imported raw material" },
                { label: "Holes", value: "26" },
                { label: "Diameter", value: "74mm" },
                { label: "Weight", value: "24.0 g" },
                { label: "Certification", value: "AIPA approved" }
            ],
            colorways: [
                { name: "Optic", hex: "#d4ff3f" },
                { name: "Bone", hex: "#f5f3ed" }
            ],
            optionLabel: "Pack size",
            options: ["6 balls", "24 balls"]
        }
    }
];

const apply = process.argv.includes("--apply");

if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Check .env.");
    process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

let updated = 0;

for (const { slugs, update } of BALLS) {
    const product = await Product.findOne({ slug: { $in: slugs } }).select(
        "_id name slug description highlights"
    );

    if (!product) {
        console.log(`? ${slugs[0].padEnd(24)} no row found under ${slugs.join(" or ")}`);
        continue;
    }

    console.log(`\n${product.name}  [${product.slug}]  ${product._id}`);
    console.log(`  was : ${(product.description ?? "").slice(0, 78)}...`);
    console.log(`  now : ${update.description.slice(0, 78)}...`);
    console.log(`  highlights: ${product.highlights?.length ?? 0} -> ${update.highlights.length}`);
    console.log(`  specs     : -> ${update.specs.length}`);

    if (apply) {
        // runValidators so a malformed spec row is refused here rather than
        // reaching the storefront as a half-written document
        await Product.updateOne(
            { _id: product._id },
            { $set: update },
            { runValidators: true }
        );
    }

    updated += 1;
}

console.log(`\n${apply ? "Updated" : "Would update"} ${updated} of ${BALLS.length} products.`);

if (!apply) {
    console.log("\nDry run. Re-run with --apply to write these changes.");
}

await mongoose.disconnect();
