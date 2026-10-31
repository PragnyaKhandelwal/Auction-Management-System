import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";
import Upload from "../models/upload.model.js";
import { dutchPriceAt, validateListing } from "../services/auctionRules.js";
import {
  BidError,
  buyAuction as buyAuctionService,
  placeBid as placeBidService,
  settleAuction,
  toPublicAuction,
} from "../services/bidding.service.js";

const optionalNumber = (value) =>
  value === "" || value == null ? null : Number(value);

// Card fields shared by every auction listing
const CARD_FIELDS =
  "itemName itemDescription currentPrice startingPrice bids itemStartDate itemEndDate itemCategory itemImage seller format buyNowPrice dutchFloor dutchDropAmount dutchDropMinutes sealedBidCount settledAt outcome";

const toCard = (item, now = new Date()) => ({
  _id: item._id,
  itemName: item.itemName,
  itemDescription: item.itemDescription,
  currentPrice:
    item.format === "dutch" && !item.settledAt
      ? dutchPriceAt(item, now)
      : item.currentPrice,
  bidsCount: item.format === "sealed" ? item.sealedBidCount : item.bids.length,
  timeLeft: Math.max(0, new Date(item.itemEndDate) - now),
  startsIn: Math.max(0, new Date(item.itemStartDate) - now),
  itemCategory: item.itemCategory,
  sellerName: item.seller?.name,
  itemPhoto: item.itemImage?.url,
  format: item.format,
  buyNowPrice: item.buyNowPrice,
  outcome: item.outcome,
});

const parsePaging = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 12));
  return { page, limit, skip: (page - 1) * limit };
};

const paginated = (auctions, total, { page, limit }) => ({
  auctions,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});

export const createAuction = async (req, res) => {
  try {
    const {
      itemName,
      itemDescription,
      itemCategory,
      itemStartDate,
      itemEndDate,
      formId,
      public_id,
      secure_url,
    } = req.body;

    const format = req.body.format || "english";
    const listing = {
      format,
      startingPrice: Number(req.body.startingPrice),
      reservePrice:
        format === "dutch" ? null : optionalNumber(req.body.reservePrice),
      buyNowPrice:
        format === "english" ? optionalNumber(req.body.buyNowPrice) : null,
      dutchFloor: optionalNumber(req.body.dutchFloor),
      dutchDropAmount: optionalNumber(req.body.dutchDropAmount),
      dutchDropMinutes: optionalNumber(req.body.dutchDropMinutes),
    };

    const listingError = validateListing(listing);
    if (listingError) {
      return res.status(400).json({ message: listingError });
    }

    const start = itemStartDate ? new Date(itemStartDate) : new Date();
    const end = new Date(itemEndDate);
    if (end <= start) {
      return res
        .status(400)
        .json({ message: "Auction end date must be after start date" });
    }

    const upload = await Upload.findOne({ formId, status: "pending" });

    if (!upload) {
      return res.status(400).json({
        message: "Invalid upload session",
      });
    }

    if (!public_id || !secure_url) {
      return res.status(400).json({
        message: "Image is required",
      });
    }

    const newAuction = new Product({
      ...listing,
      itemName,
      currentPrice: listing.startingPrice,
      itemDescription,
      itemCategory,
      itemImage: {
        public_id,
        url: secure_url,
      },
      itemStartDate: start,
      itemEndDate: end,
      seller: req.user.id,
    });
    await newAuction.save();

    upload.status = "used";
    await upload.save();

    res
      .status(201)
      .json({ message: "Auction created successfully", newAuction });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating auction", error: error.message });
  }
};

const SORTS = {
  ending: { itemEndDate: 1 },
  newest: { createdAt: -1 },
  price_low: { currentPrice: 1 },
  price_high: { currentPrice: -1 },
};

export const showAuction = async (req, res) => {
  try {
    const paging = parsePaging(req.query);
    const { q, category, format, sort } = req.query;

    const filter = { itemEndDate: { $gt: new Date() }, settledAt: null };
    if (typeof category === "string" && category) {
      filter.itemCategory = category;
    }
    if (typeof format === "string" && format) filter.format = format;
    if (typeof q === "string" && q.trim()) {
      filter.$text = { $search: q.trim() };
    }

    const total = await Product.countDocuments(filter);

    const auction = await Product.find(filter)
      .populate("seller", "name")
      .select(CARD_FIELDS)
      .sort(SORTS[sort] || SORTS.newest)
      .skip(paging.skip)
      .limit(paging.limit);

    res.status(200).json(paginated(auction.map((a) => toCard(a)), total, paging));
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching auctions", error: error.message });
  }
};

export const auctionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // The worker normally closes auctions; this covers serverless hosts without one
    const check = await Product.findById(id).select("itemEndDate settledAt");
    if (!check) {
      return res.status(404).json({ message: "Auction not found" });
    }
    if (!check.settledAt && new Date(check.itemEndDate) <= new Date()) {
      await settleAuction(id);
    }

    const auction = await Product.findById(id)
      .select("+proxyBids +sealedBids")
      .populate("seller", "name")
      .populate("bids.bidder", "name")
      .populate("winner", "name");

    const viewer = await User.findById(userId).select("watchlist");
    const isWatching = !!viewer?.watchlist?.some((w) => w.toString() === id);

    // If auction is expired, only allow seller, bidders and watchers to view it
    const isExpired = new Date(auction.itemEndDate) <= new Date();
    if (isExpired) {
      const isSeller = auction.seller._id.toString() === userId;
      const isBidder = auction.bids.some(
        (b) => b.bidder?._id?.toString() === userId,
      );
      if (!isSeller && !isBidder && !isWatching) {
        return res.status(403).json({
          message: "This auction has ended and is no longer available",
        });
      }
    }

    auction.bids.sort((a, b) => new Date(b.bidTime) - new Date(a.bidTime));

    res.status(200).json({
      ...toPublicAuction(auction, userId),
      isWatching,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching auctions", error: error.message });
  }
};

const sendBidError = (res, error, fallback) => {
  if (error instanceof BidError) {
    return res.status(error.status).json({ message: error.message });
  }
  return res.status(500).json({ message: fallback, error: error.message });
};

export const placeBid = async (req, res) => {
  try {
    const viewer = await User.findById(req.user.id).select("name");
    const result = await placeBidService({
      auctionId: req.params.id,
      userId: req.user.id,
      userName: viewer?.name,
      amount: Number(req.body.bidAmount),
      maxBid: optionalNumber(req.body.maxBid),
    });
    res.status(200).json(result);
  } catch (error) {
    sendBidError(res, error, "Error placing bid");
  }
};

export const buyAuction = async (req, res) => {
  try {
    const result = await buyAuctionService({
      auctionId: req.params.id,
      userId: req.user.id,
    });
    res.status(200).json({
      ...result,
      message: `You won this auction for Rs ${result.price.toLocaleString("en-IN")}`,
    });
  } catch (error) {
    sendBidError(res, error, "Error completing purchase");
  }
};

export const toggleWatch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!(await Product.exists({ _id: id }))) {
      return res.status(404).json({ message: "Auction not found" });
    }
    const removed = await User.findOneAndUpdate(
      { _id: req.user.id, watchlist: id },
      { $pull: { watchlist: id } },
    );
    if (!removed) {
      await User.updateOne(
        { _id: req.user.id },
        { $addToSet: { watchlist: id } },
      );
    }
    res.status(200).json({ isWatching: !removed });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating watchlist", error: error.message });
  }
};

export const watchlist = async (req, res) => {
  try {
    const paging = parsePaging(req.query);
    const viewer = await User.findById(req.user.id).select("watchlist");
    const filter = { _id: { $in: viewer?.watchlist ?? [] } };
    const total = await Product.countDocuments(filter);

    const auction = await Product.find(filter)
      .populate("seller", "name")
      .select(CARD_FIELDS)
      .sort({ itemEndDate: 1 })
      .skip(paging.skip)
      .limit(paging.limit);

    res.status(200).json(paginated(auction.map((a) => toCard(a)), total, paging));
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching watchlist", error: error.message });
  }
};

export const dashboardData = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const dateNow = new Date();
    const stats = await Product.aggregate([
      {
        $facet: {
          totalAuctions: [{ $count: "count" }],
          userAuctionCount: [
            { $match: { seller: userObjectId } },
            { $count: "count" },
          ],
          activeAuctions: [
            {
              $match: {
                itemStartDate: { $lte: dateNow },
                itemEndDate: { $gte: dateNow },
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]);

    const totalAuctions = stats[0].totalAuctions[0]?.count || 0;
    const userAuctionCount = stats[0].userAuctionCount[0]?.count || 0;
    const activeAuctions = stats[0].activeAuctions[0]?.count || 0;

    const globalAuction = await Product.find({ itemEndDate: { $gt: dateNow } })
      .populate("seller", "name")
      .sort({ createdAt: -1 })
      .limit(4);

    const userAuction = await Product.find({ seller: userObjectId })
      .populate("seller", "name")
      .sort({ createdAt: -1 })
      .limit(4);

    return res.status(200).json({
      totalAuctions,
      userAuctionCount,
      activeAuctions,
      latestAuctions: globalAuction.map((a) => toCard(a)),
      latestUserAuctions: userAuction.map((a) => toCard(a)),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error getting dashboard data", error: error.message });
  }
};

export const myAuction = async (req, res) => {
  try {
    const paging = parsePaging(req.query);

    const filter = { seller: req.user.id };
    const total = await Product.countDocuments(filter);

    const auction = await Product.find(filter)
      .populate("seller", "name")
      .select(CARD_FIELDS)
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit);

    res.status(200).json(paginated(auction.map((a) => toCard(a)), total, paging));
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching auctions", error: error.message });
  }
};

export const myBids = async (req, res) => {
  try {
    const paging = parsePaging(req.query);
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const filter = {
      $or: [{ "bids.bidder": userId }, { "sealedBids.bidder": userId }],
    };
    const total = await Product.countDocuments(filter);

    const auction = await Product.find(filter)
      .populate("seller", "name")
      .populate("winner", "name")
      .select(`${CARD_FIELDS} winner isSold`)
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit);

    const formatted = auction.map((item) => ({
      ...toCard(item),
      isExpired: new Date(item.itemEndDate) < new Date(),
      winner: item.winner
        ? { _id: item.winner._id, name: item.winner.name }
        : null,
      isSold: item.isSold,
    }));

    res.status(200).json(paginated(formatted, total, paging));
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching my bids", error: error.message });
  }
};
