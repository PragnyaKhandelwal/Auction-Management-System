import mongoose from "mongoose";

// One rating per person per settled lot: the winner rates the seller and the
// seller rates the winner. Reviews cannot be edited, so the record stays honest.
const reviewSchema = new mongoose.Schema(
  {
    auction: { type: mongoose.Schema.ObjectId, ref: "Product", required: true },
    reviewer: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
    reviewee: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
    // The reviewer's side of the sale
    role: { type: String, enum: ["buyer", "seller"], required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

reviewSchema.index({ auction: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ reviewee: 1, role: 1 });

const Review = mongoose.model("Review", reviewSchema);
export default Review;
