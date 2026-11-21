import express from "express";
import {
  handleUserSignup,
  handleUserLogin,
  handleUserLogout,
  handleSession,
} from "../controllers/auth.controller.js";
const authRoutes = express.Router();

authRoutes.post("/login", handleUserLogin);
authRoutes.post("/signup", handleUserSignup);
authRoutes.post("/logout", handleUserLogout);
authRoutes.get("/session", handleSession);

export default authRoutes;