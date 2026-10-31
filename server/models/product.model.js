import mongoose from "mongoose";

const bidSchema = new mongoose.Schema({
  bidder: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
  bidAmount: { type: Number, required: true },
  bidTime: { type: Date, default: Date.now },
  isAuto: { type: Boolean, default: false },
});

// Bidder's private auto-bid ceiling (English)
const proxyBidSchema = new mongoose.Schema(
  {
    bidder: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
    maxAmount: { type: Number, required: true },
  },
  { _id: false },
);

// One hidden bid per bidder until settlement (Sealed)
const sealedBidSchema = new mongoose.Schema(
  {
    bidder: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    placedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    itemDescription: {
      type: String,
      required: true,
    },
    itemCategory: {
      type: String,
      required: true,
    },
    itemImage: {
      public_id: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },
    startingPrice: {
      type: Number,
      required: true,
      min: [1, "Starting price must be at least 1"],
    },
    currentPrice: {
      type: Number,
      default: 0,
    },
    itemStartDate: {
      type: Date,
      default: Date.now,
    },
    itemEndDate: {
      type: Date,
      required: true,
    },
    seller: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    bids: [bidSchema],
    winner: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
    isSold: {
      type: Boolean,
      default: false,
    },
    format: {
      type: String,
      enum: ["english", "dutch", "sealed"],
      default: "english",
    },
    reservePrice: {
      type: Number,
      default: null,
    },
    buyNowPrice: {
      type: Number,
      default: null,
    },
    dutchFloor: Number,
    dutchDropAmount: Number,
    dutchDropMinutes: Number,
    highBidder: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      default: null,
    },
    // Secret until settlement: excluded from every query unless asked for
    proxyBids: { type: [proxyBidSchema], select: false },
    sealedBids: { type: [sealedBidSchema], select: false },
    sealedBidCount: {
      type: Number,
      default: 0,
    },
    // Compare-and-swap counter: every accepted bid must match and increment it
    bidSeq: {
      type: Number,
      default: 0,
    },
    extensions: {
      type: Number,
      default: 0,
    },
    endingSoonSent: {
      type: Boolean,
      default: false,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    outcome: {
      type: String,
      enum: ["sold", "reserve_not_met", "no_bids", null],
      default: null,
    },
  },
  { timestamps: true },
);

productSchema.index({ settledAt: 1, itemEndDate: 1 });
productSchema.index({ itemName: "text", itemDescription: "text" });

// Indexes for frequently queried fields
productSchema.index({ itemEndDate: 1 });
productSchema.index({ seller: 1 });
productSchema.index({ itemCategory: 1 });
productSchema.index({ createdAt: -1 });

const Product = mongoose.model("Product", productSchema);
export default Product;
