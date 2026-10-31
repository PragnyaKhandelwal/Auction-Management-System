import express from "express";
import {
  getAdminDashboard,
  getAllUsers,
  getFairPlayReport,
} from "../controllers/admin.controller.js";
import { checkAdmin, secureRoute } from "../middleware/auth.middleware.js";

const adminRoutes = express.Router();
adminRoutes.use(secureRoute);

adminRoutes.get("/dashboard", checkAdmin, getAdminDashboard);
adminRoutes.get("/users", checkAdmin, getAllUsers);
adminRoutes.get("/fair-play", checkAdmin, getFairPlayReport);

export default adminRoutes;
