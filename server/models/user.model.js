import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },
    // Only accounts that sign in with email and password have one
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
    },
    // Google account ID ("sub"), set when the user signs in with Google
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    avatar: {
      type: String,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    location: {
      country: { type: String },
      region: { type: String },
      city: { type: String },
      isp: { type: String },
    },
    signupAt: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    watchlist: [{ type: mongoose.Schema.ObjectId, ref: "Product" }],
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
