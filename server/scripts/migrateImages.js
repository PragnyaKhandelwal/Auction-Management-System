import mongoose from "mongoose";
import Product from "../models/product.model.js";
import { env } from "../config/env.config.js";

const extractPublicId = (url) => {
  try {
    if (!url || typeof url !== "string") return null;

    const filename = url.split("/").pop();
    if (!filename) return null;

    return filename.replace(/(\.[^/.]+)+$/, "");
  } catch {
    return null;
  }
};

const migrate = async () => {
  try {
    await mongoose.connect(env.mongo_uri);
    console.log("DB connected\n");

    const products = await Product.find({
      itemPhoto: { $type: "string", $ne: "" },
    }).lean();

    console.log(`Found ${products.length} products\n`);

    let success = 0;
    let skipped = 0;

    for (const product of products) {
      try {
        const url = product.itemPhoto;
        const public_id = extractPublicId(url);

        if (!url || !public_id) {
          console.log(`Skipped: ${product._id}`);
          skipped++;
          continue;
        }

        await Product.updateOne(
          { _id: product._id },
          {
            $set: {
              itemImage: {
                public_id,
                url,
              },
              itemPhotoBackup: url,
            },
            $unset: {
              itemPhoto: "",
            },
          },
        );

        console.log(`Migrated: ${product._id}`);
        success++;
      } catch (err) {
        console.log(`Error: ${product._id}`, err.message);
        skipped++;
      }
    }

    console.log("\nMigration Complete");
    console.log(`Success: ${success}`);
    console.log(`Skipped: ${skipped}`);

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
};

migrate();
