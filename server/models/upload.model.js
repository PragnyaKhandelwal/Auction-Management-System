import mongoose from "mongoose";

const uploadSchema = new mongoose.Schema(
  {
    formId: {
      type: String,
      required: true,
      unique: true,
    },
    public_id: {
      type: String,
      default: null,
    },
    secure_url: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "used"],
      default: "pending",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Upload", uploadSchema);
