import express from "express";
import {
  createAuction,
  showAuction,
  auctionById,
  placeBid,
  dashboardData,
  myAuction,
  myBids,
} from "../controllers/auction.controller.js";
import { secureRoute } from "../middleware/auth.middleware.js";

const auctionRoutes = express.Router();
auctionRoutes.use(secureRoute);

auctionRoutes.get("/stats", dashboardData);

auctionRoutes
  .route("/")
  .get(showAuction)
  .post( createAuction);

auctionRoutes.get("/myauction", myAuction);
auctionRoutes.get("/mybids", myBids);

auctionRoutes.get("/:id", auctionById);
auctionRoutes.post("/:id/bid", placeBid);

export default auctionRoutes;
