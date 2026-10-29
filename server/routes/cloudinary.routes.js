import express from "express";
import { getUploadSignature } from "../controllers/cloudinary.controller.js";
import { secureRoute } from "../middleware/auth.middleware.js";

const Cloudinaryrouter = express.Router();
Cloudinaryrouter.use(secureRoute);

Cloudinaryrouter.get("/signature", getUploadSignature);

export default Cloudinaryrouter;
