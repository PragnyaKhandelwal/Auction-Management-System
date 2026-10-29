import express from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.config.js";
import {
  authRoutes,
  userRoutes,
  auctionRoutes,
  contactRoutes,
  adminRoutes,
  cloudinaryRoutes,
} from "./routes/index.js";
import { connectDB } from "./config/db.config.js";
import cron from "node-cron";
import { cleanupUnusedUploads } from "./jobs/cleanupUploads.js";

export const app = express();

app.use(
  cors({
    origin: env.origin,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(compression());
app.use(express.json());

// DB connection for Vercel serveless deployment
if (process.env.VERCEL) {
  app.use(async (req, res, next) => {
    await connectDB();
    next();
  });
}

let isRunning = false;

// Daily cleanup cron job
cron.schedule("0 0 * * *", async () => { // Runs at midnight every day
  if (isRunning) return;

  isRunning = true;

  try {
    await cleanupUnusedUploads();
  } catch (err) {
    console.error(err);
  } finally {
    isRunning = false;
  }
});

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/auction", auctionRoutes);
app.use("/contact", contactRoutes);
app.use("/admin", adminRoutes);
app.use("/upload", cloudinaryRoutes);

export default app; // Exporting default app for serverless deployment
