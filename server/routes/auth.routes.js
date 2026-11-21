import express from "express";
import {
  handleUserSignup,
  handleUserLogin,
  handleUserLogout,
  handleSession,
  handleGoogleConfig,
  handleGoogleLogin,
} from "../controllers/auth.controller.js";
const authRoutes = express.Router();

authRoutes.post("/login", handleUserLogin);
authRoutes.post("/signup", handleUserSignup);
authRoutes.post("/logout", handleUserLogout);
authRoutes.get("/session", handleSession);
authRoutes.get("/google/config", handleGoogleConfig);
authRoutes.post("/google", handleGoogleLogin);

export default authRoutes;