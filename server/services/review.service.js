import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Review from "../models/review.model.js";
import User from "../models/user.model.js";
import { notify } from "./notification.service.js";
import { reviewRoleFor, sellerTrust, validateReview } from "./trust.js";

export class ReviewError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Ratings buyers gave this seller, plus their completed sales
export const getSellerTrust = async (sellerId) => {
  const seller = new mongoose.Types.ObjectId(sellerId.toString());
  const [ratings, completedSales] = await Promise.all([
    Review.aggregate([
      { $match: { reviewee: seller, role: "buyer" } },
      { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$rating" } } },
    ]),
    Product.countDocuments({ seller, outcome: "sold" }),
  ]);
  return sellerTrust({
    ratingCount: ratings[0]?.count ?? 0,
    ratingSum: ratings[0]?.sum ?? 0,
    completedSales,
  });
};

const publicReview = (review) =>
  review && {
    _id: review._id,
    role: review.role,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  };

// What this viewer can do about reviews on this lot
export const reviewStateFor = async (auction, userId) => {
  const side = reviewRoleFor(auction, userId);
  if (side.error) return { canReview: false, myReview: null, theirReview: null };

  const [mine, theirs] = await Promise.all([
    Review.findOne({ auction: auction._id, reviewer: userId }).lean(),
    Review.findOne({ auction: auction._id, reviewer: side.revieweeId }).lean(),
  ]);
  return {
    canReview: !mine,
    role: side.role,
    myReview: publicReview(mine),
    theirReview: publicReview(theirs),
  };
};

export const submitReview = async ({ auctionId, userId, rating, comment }) => {
  if (!mongoose.isValidObjectId(auctionId)) {
    throw new ReviewError(404, "Auction not found");
  }
  const auction = await Product.findById(auctionId)
    .select("itemName seller winner settledAt outcome")
    .lean();
  if (!auction) throw new ReviewError(404, "Auction not found");

  const side = reviewRoleFor(auction, userId);
  if (side.error) throw new ReviewError(403, side.error);

  const input = validateReview({ rating, comment });
  if (input.error) throw new ReviewError(400, input.error);

  let review;
  try {
    review = await Review.create({
      auction: auction._id,
      reviewer: userId,
      reviewee: side.revieweeId,
      role: side.role,
      rating: input.rating,
      comment: input.comment,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ReviewError(409, "You have already reviewed this sale");
    }
    throw error;
  }

  const reviewer = await User.findById(userId).select("name").lean();
  const stars = `${input.rating} star${input.rating === 1 ? "" : "s"}`;
  await notify([side.revieweeId], {
    type: "review",
    message: `${reviewer?.name ?? "Someone"} rated you ${stars} for ${auction.itemName}.`,
    auction: auction._id,
  });

  return publicReview(review);
};
