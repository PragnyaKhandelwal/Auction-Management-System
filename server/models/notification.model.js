import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["outbid", "won", "lost", "sold", "unsold", "ending_soon"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    auction: {
      type: mongoose.Schema.ObjectId,
      ref: "Product",
    },
    read: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 60, // Auto-delete after 60 days
    },
  },
);

notificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
