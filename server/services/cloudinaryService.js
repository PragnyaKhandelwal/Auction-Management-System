// Old logic for uploading images to Cloudinary (not in use now)

import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.config.js";

cloudinary.config({
  cloud_name: env.cloudinary_cloud_name,
  api_key: env.cloudinary_api_key,
  api_secret: env.cloudinary_api_secret,
});

/**
 * Get image URL from multer-cloudinary upload.
 * CloudinaryStorage already uploads the file — req.file.path is the Cloudinary URL.
 * No need to re-upload.
 */
const getImageUrl = (file) => {
  if (!file || !file.path) {
    throw new Error("No file uploaded");
  }
  return file.path;
};

export default getImageUrl;
export { cloudinary };
