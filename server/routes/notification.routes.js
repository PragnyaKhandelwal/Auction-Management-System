import express from "express";
import {
  getNotifications,
  markAllRead,
} from "../controllers/notification.controller.js";
import { secureRoute } from "../middleware/auth.middleware.js";

const notificationRoutes = express.Router();
notificationRoutes.use(secureRoute);

notificationRoutes.get("/", getNotifications);
notificationRoutes.patch("/read", markAllRead);

export default notificationRoutes;
