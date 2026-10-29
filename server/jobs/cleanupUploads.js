import Upload from "../models/upload.model.js";
import cloudinary from "../config/cloudinary.config.js";

export const cleanupUnusedUploads = async () => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const unusedUploads = await Upload.find({
      status: "pending",
      createdAt: { $lt: tenMinutesAgo },
    });

    for (const upload of unusedUploads) {
      if (upload.public_id) {
        try {
          await cloudinary.uploader.destroy(upload.public_id);
          console.log("Deleted from Cloudinary:", upload.public_id);
        } catch (err) {
          console.log("Cloudinary delete failed:", err.message);
        }
      }

      await Upload.deleteOne({ _id: upload._id });
      console.log("Deleted from DB:", upload._id);
    }

    console.log("Cleanup job completed");
  } catch (error) {
    console.error("Cleanup error:", error.message);
  }
};