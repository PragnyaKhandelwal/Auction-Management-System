import { generateUploadSignature, saveUploadData } from "../services/cloudinary.service.js";

// Get upload signature
export const getUploadSignature = async (req, res) => {
  try {
    const data = await generateUploadSignature();

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate signature",
    });
  }
};