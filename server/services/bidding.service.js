import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import { getIO } from "../socket/index.js";
import { notify } from "./notification.service.js";
import {
  dutchPriceAt,
  extendedEndDate,
  minIncrement,
  nextMinimumBid,
  resolveEnglishBid,
  settleEnglish,
  settleSealed,
} from "./auctionRules.js";

const CAS_RETRIES = 5;

const rupees = (amount) => `Rs ${amount.toLocaleString("en-IN")}`;

export class BidError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const emitToRoom = (auctionId, event, payload) => {
  try {
    getIO().to(auctionId.toString()).emit(event, payload);
  } catch (socketErr) {
    console.error("Socket broadcast error:", socketErr.message);
  }
};

const assertOpen = (auction, userId, now) => {
  if (!auction) throw new BidError(404, "Auction not found");
  if (auction.seller.toString() === userId) {
    throw new BidError(403, "You cannot bid on your own auction");
  }
  if (auction.settledAt || new Date(auction.itemEndDate) <= now) {
    throw new BidError(400, "Auction has already ended");
  }
  if (new Date(auction.itemStartDate) > now) {
    throw new BidError(400, "Auction has not started yet");
  }
};

// Runs a read-decide-write cycle, re-reading when another bid got in first.
// `attempt` returns the update to apply, guarded by the bidSeq it read.
const withCas = async (auctionId, attempt) => {
  for (let i = 0; i < CAS_RETRIES; i++) {
    const auction = await Product.findById(auctionId).select(
      "+proxyBids +sealedBids",
    );
    const now = new Date();
    const { update, result } = await attempt(auction, now);

    const updated = await Product.findOneAndUpdate(
      {
        _id: auctionId,
        bidSeq: auction.bidSeq,
        settledAt: null,
        itemEndDate: { $gt: now },
      },
      { ...update, $inc: { ...update.$inc, bidSeq: 1 } },
      { new: true },
    );
    if (updated) return { auction: updated, ...result };
  }
  throw new BidError(409, "Bidding is very busy. Please try again.");
};

// Public shape of an auction for anyone: secrets removed, live values computed.
// With a viewerId it also includes that viewer's own private figures.
export const toPublicAuction = (auction, viewerId = null, now = new Date()) => {
  const raw = auction.toObject ? auction.toObject() : auction;
  const { proxyBids, sealedBids, reservePrice, ...view } = raw;

  view.hasReserve = reservePrice != null;
  view.reserveMet =
    reservePrice != null ? raw.currentPrice >= reservePrice : null;
  view.minNextBid = nextMinimumBid({
    currentPrice: raw.currentPrice,
    startingPrice: raw.startingPrice,
    hasBids: (raw.bids?.length ?? 0) > 0,
  });
  view.bidStep = minIncrement(raw.currentPrice);
  if (raw.format === "dutch" && !raw.settledAt) {
    view.currentPrice = dutchPriceAt(raw, now);
  }

  if (viewerId) {
    const sellerId = (raw.seller?._id ?? raw.seller)?.toString();
    if (sellerId === viewerId) view.reservePrice = reservePrice;
    const mineIs = (entry) => entry.bidder?.toString() === viewerId;
    view.myMaxBid = proxyBids?.find(mineIs)?.maxAmount ?? null;
    view.mySealedBid = sealedBids?.find(mineIs)?.amount ?? null;
  }
  return view;
};

const populateForView = (query) =>
  query
    .populate("seller", "name")
    .populate("bids.bidder", "name")
    .populate("winner", "name");

const broadcastAuction = async (auctionId, extra = {}) => {
  const fresh = await populateForView(Product.findById(auctionId));
  fresh.bids.sort((a, b) => new Date(b.bidTime) - new Date(a.bidTime));
  const auction = toPublicAuction(fresh);
  emitToRoom(auctionId, "auction:bidPlaced", { auction, ...extra });
  return auction;
};

const placeEnglishBid = async ({ auctionId, userId, userName, amount, maxBid }) => {
  const { auction, decision, previousLeader } = await withCas(
    auctionId,
    async (current, now) => {
      assertOpen(current, userId, now);
      if (current.format !== "english") {
        throw new BidError(400, "This auction does not take open bids");
      }
      const previousLeader =
        current.highBidder ?? current.bids.at(-1)?.bidder ?? null;
      const decision = resolveEnglishBid({
        currentPrice: current.currentPrice,
        startingPrice: current.startingPrice,
        hasBids: current.bids.length > 0,
        reservePrice: current.reservePrice,
        leaderId: previousLeader,
        proxyBids: current.proxyBids,
        bidderId: userId,
        amount,
        maxBid,
      });
      if (decision.error) throw new BidError(400, decision.error);

      const $set = {
        currentPrice: decision.price,
        highBidder: decision.leaderId,
        proxyBids: decision.proxyBids,
      };
      const newEnd = decision.ceilingOnly ? null : extendedEndDate(current, now);
      const update = {
        $set,
        $push: { bids: { $each: decision.rows } },
      };
      if (newEnd) {
        $set.itemEndDate = newEnd;
        update.$inc = { extensions: 1 };
      }
      return {
        update,
        result: { decision, previousLeader, extendedTo: newEnd },
      };
    },
  );

  const view = await broadcastAuction(auctionId, {
    bidderName: userName,
    bidderId: userId,
    bidAmount: decision.price,
    silent: !!decision.ceilingOnly,
  });

  // A bidder beaten instantly by an auto-bid hears about it in the bid response
  if (decision.leaderChanged && previousLeader) {
    await notify([previousLeader], {
      type: "outbid",
      message: `You were outbid on ${auction.itemName}. It is now at ${rupees(decision.price)}.`,
      auction: auction._id,
    });
  }

  return {
    auction: view,
    outbidImmediately: !!decision.outbidImmediately,
    message: decision.ceilingOnly
      ? `Auto-bid limit raised to ${rupees(maxBid)}`
      : decision.outbidImmediately
        ? `Another bidder's auto-bid is higher. Price is now ${rupees(decision.price)}`
        : "You are the highest bidder",
  };
};

const placeSealedBid = async ({ auctionId, userId, amount }) => {
  await withCas(auctionId, async (current, now) => {
    assertOpen(current, userId, now);
    if (amount < current.startingPrice) {
      throw new BidError(400, `Bid must be at least Rs ${current.startingPrice}`);
    }
    const others = current.sealedBids.filter(
      (b) => b.bidder.toString() !== userId,
    );
    const sealedBids = [...others, { bidder: userId, amount, placedAt: now }];
    return {
      update: {
        $set: { sealedBids, sealedBidCount: sealedBids.length },
      },
      result: {},
    };
  });

  // Only the count goes out: amounts stay hidden until settlement
  const fresh = await populateForView(Product.findById(auctionId));
  emitToRoom(auctionId, "auction:bidPlaced", {
    auction: toPublicAuction(fresh),
    silent: true,
  });
  const withMine = await populateForView(
    Product.findById(auctionId).select("+sealedBids"),
  );
  return {
    auction: toPublicAuction(withMine, userId),
    message: "Your sealed bid is in. You can change it until the auction closes.",
  };
};

// Entry point shared by the REST route and the socket handler
export const placeBid = async ({ auctionId, userId, userName, amount, maxBid }) => {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new BidError(400, "Bid must be a whole number of rupees");
  }
  if (maxBid != null && (!Number.isInteger(maxBid) || maxBid <= 0)) {
    throw new BidError(400, "Auto-bid limit must be a whole number of rupees");
  }
  const auction = await Product.findById(auctionId).select("format");
  if (!auction) throw new BidError(404, "Auction not found");
  if (auction.format === "dutch") {
    throw new BidError(400, "Dutch auctions are won by accepting the live price");
  }
  return auction.format === "sealed"
    ? placeSealedBid({ auctionId, userId, amount })
    : placeEnglishBid({ auctionId, userId, userName, amount, maxBid });
};

const announceSettlement = async (auction) => {
  const fresh = await populateForView(Product.findById(auction._id));
  fresh.bids.sort((a, b) => new Date(b.bidTime) - new Date(a.bidTime));
  emitToRoom(auction._id, "auction:settled", {
    auction: toPublicAuction(fresh),
  });

  const name = auction.itemName;
  const refs = { auction: auction._id };
  const winnerId = auction.winner?.toString();

  if (auction.outcome === "sold") {
    await notify([auction.winner], {
      ...refs,
      type: "won",
      message: `You won ${name} for ${rupees(auction.currentPrice)}.`,
    });
    await notify([auction.seller], {
      ...refs,
      type: "sold",
      message: `${name} sold for ${rupees(auction.currentPrice)}.`,
    });
  } else {
    await notify([auction.seller], {
      ...refs,
      type: "unsold",
      message:
        auction.outcome === "reserve_not_met"
          ? `${name} closed below your reserve and did not sell.`
          : `${name} closed with no bids.`,
    });
  }

  const losers = auction.bids
    .map((b) => b.bidder.toString())
    .filter((id) => id !== winnerId);
  await notify(losers, {
    ...refs,
    type: "lost",
    message:
      auction.outcome === "reserve_not_met"
        ? `${name} closed without meeting its reserve price.`
        : `${name} has closed and you did not win it.`,
  });
};

// Buy Now (English) or accepting the live price (Dutch): instant win
export const buyAuction = async ({ auctionId, userId }) => {
  const { auction, price } = await withCas(auctionId, async (current, now) => {
    assertOpen(current, userId, now);
    let price;
    if (current.format === "dutch") {
      price = dutchPriceAt(current, now);
    } else if (current.format === "english" && current.buyNowPrice) {
      if (current.currentPrice >= current.buyNowPrice) {
        throw new BidError(400, "Bidding has passed the Buy Now price");
      }
      price = current.buyNowPrice;
    } else {
      throw new BidError(400, "This auction cannot be bought outright");
    }
    return {
      update: {
        $set: {
          currentPrice: price,
          highBidder: userId,
          winner: userId,
          isSold: true,
          outcome: "sold",
          settledAt: now,
          itemEndDate: now,
        },
        $push: { bids: { bidder: userId, bidAmount: price } },
      },
      result: { price },
    };
  });

  await announceSettlement(auction);
  const fresh = await populateForView(Product.findById(auctionId));
  fresh.bids.sort((a, b) => new Date(b.bidTime) - new Date(a.bidTime));
  return { auction: toPublicAuction(fresh, userId), price };
};

// Closes one finished auction. Safe to call repeatedly or concurrently: the
// settledAt guard means only one caller wins and announces the result.
export const settleAuction = async (auctionId) => {
  const auction = await Product.findById(auctionId).select(
    "+proxyBids +sealedBids",
  );
  if (!auction || auction.settledAt) return null;

  const now = new Date();
  let decision;
  const $set = { settledAt: now };
  if (auction.format === "sealed") {
    decision = settleSealed(auction);
    // Reveal: sealed amounts become the public bid history
    $set.bids = auction.sealedBids.map((b) => ({
      bidder: b.bidder,
      bidAmount: b.amount,
      bidTime: b.placedAt,
    }));
  } else if (auction.format === "dutch") {
    decision = { outcome: "no_bids" }; // A sold Dutch lot settles when accepted
  } else {
    decision = settleEnglish(auction);
  }

  $set.outcome = decision.outcome;
  if (decision.outcome === "sold") {
    $set.winner = decision.winner;
    $set.isSold = true;
    $set.currentPrice = decision.finalPrice;
  }

  const settled = await Product.findOneAndUpdate(
    { _id: auctionId, settledAt: null, bidSeq: auction.bidSeq },
    { $set },
    { new: true },
  );
  if (!settled) return null;

  await announceSettlement(settled);
  return settled;
};

export const settleDueAuctions = async (now = new Date()) => {
  const due = await Product.find({
    settledAt: null,
    itemEndDate: { $lte: now },
  })
    .select("_id")
    .limit(100);
  for (const { _id } of due) {
    await settleAuction(_id);
  }
  return due.length;
};

const ENDING_SOON_MS = 10 * 60 * 1000;

export const remindWatchers = async (now = new Date()) => {
  const soon = await Product.find({
    settledAt: null,
    endingSoonSent: false,
    itemEndDate: { $gt: now, $lte: new Date(now.getTime() + ENDING_SOON_MS) },
  }).select("itemName");

  for (const auction of soon) {
    const claimed = await Product.findOneAndUpdate(
      { _id: auction._id, endingSoonSent: false },
      { $set: { endingSoonSent: true } },
    );
    if (!claimed) continue;
    const watchers = await User.find({ watchlist: auction._id }).select("_id");
    await notify(
      watchers.map((w) => w._id),
      {
        type: "ending_soon",
        message: `${auction.itemName} closes in under 10 minutes.`,
        auction: auction._id,
      },
    );
  }
};
