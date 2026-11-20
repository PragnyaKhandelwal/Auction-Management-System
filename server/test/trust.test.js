import "./setup.js";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import Review from "../models/review.model.js";
import Notification from "../models/notification.model.js";
import { reviewRoleFor, sellerTrust, validateReview } from "../services/trust.js";
import { getSellerTrust, submitReview } from "../services/review.service.js";
import { auctionById, reviewAuction } from "../controllers/auction.controller.js";

const HOUR = 60 * 60 * 1000;
const oid = () => new mongoose.Types.ObjectId();

describe("reviewRoleFor", () => {
  const seller = oid();
  const winner = oid();
  const sold = { seller, winner, settledAt: new Date(), outcome: "sold" };

  test("winner reviews the seller and seller reviews the winner", () => {
    assert.deepEqual(reviewRoleFor(sold, winner.toString()), {
      role: "buyer",
      revieweeId: seller.toString(),
    });
    assert.deepEqual(reviewRoleFor(sold, seller.toString()), {
      role: "seller",
      revieweeId: winner.toString(),
    });
  });

  test("works with populated seller and winner", () => {
    const populated = {
      ...sold,
      seller: { _id: seller, name: "S" },
      winner: { _id: winner, name: "W" },
    };
    assert.equal(reviewRoleFor(populated, winner.toString()).role, "buyer");
  });

  test("anyone else is refused", () => {
    assert.match(reviewRoleFor(sold, oid().toString()).error, /winning bidder and the seller/);
  });

  test("open and unsold lots cannot be reviewed", () => {
    assert.match(
      reviewRoleFor({ ...sold, settledAt: null }, winner.toString()).error,
      /once the auction settles/,
    );
    for (const outcome of ["no_bids", "reserve_not_met"]) {
      assert.match(
        reviewRoleFor({ ...sold, outcome, winner: null }, seller.toString()).error,
        /ended in a sale/,
      );
    }
  });
});

describe("validateReview", () => {
  test("accepts whole stars 1 to 5 and trims the comment", () => {
    assert.deepEqual(validateReview({ rating: 5, comment: "  Great  " }), {
      rating: 5,
      comment: "Great",
    });
    assert.deepEqual(validateReview({ rating: "1" }), { rating: 1, comment: "" });
  });

  test("rejects ratings outside 1 to 5 or not whole", () => {
    for (const rating of [0, 6, 3.5, "abc", null, undefined, -1]) {
      assert.ok(validateReview({ rating }).error, `rating ${rating}`);
    }
  });

  test("rejects long or non-text comments", () => {
    assert.match(validateReview({ rating: 4, comment: "x".repeat(501) }).error, /500/);
    assert.ok(validateReview({ rating: 4, comment: "x".repeat(500) }).comment);
    assert.ok(validateReview({ rating: 4, comment: { $gt: "" } }).error);
  });
});

describe("sellerTrust", () => {
  test("no ratings gives no average and no badge", () => {
    assert.deepEqual(sellerTrust({}), {
      averageRating: null,
      ratingCount: 0,
      completedSales: 0,
      verified: false,
    });
  });

  test("average is rounded to one decimal", () => {
    assert.equal(sellerTrust({ ratingCount: 3, ratingSum: 14 }).averageRating, 4.7);
  });

  test("badge needs 3 sales, 3 ratings and an average of 4 or more", () => {
    const base = { completedSales: 3, ratingCount: 3, ratingSum: 12 };
    assert.equal(sellerTrust(base).verified, true);
    assert.equal(sellerTrust({ ...base, completedSales: 2 }).verified, false);
    assert.equal(sellerTrust({ ...base, ratingCount: 2, ratingSum: 10 }).verified, false);
    // 3.97 rounds to 4.0 on screen but is below the bar
    assert.equal(sellerTrust({ completedSales: 30, ratingCount: 30, ratingSum: 119 }).verified, false);
  });
});

// Minimal Express response double
const fakeRes = () => {
  const res = { statusCode: 200 };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
};

const call = async (handler, { id, user, body }) => {
  const res = fakeRes();
  await handler({ params: { id }, body, query: {}, user }, res);
  return res;
};

describe("reviews against the database", () => {
  let mongo;
  let seller, buyer, other;

  const as = (u) => ({ id: u._id.toString(), role: "user" });

  const lot = (overrides = {}) =>
    Product.create({
      itemName: "Brass lamp",
      itemDescription: "A lot",
      itemCategory: "Art",
      itemImage: { public_id: "x", url: "http://x" },
      startingPrice: 1000,
      currentPrice: 1200,
      itemStartDate: new Date(Date.now() - 3 * HOUR),
      itemEndDate: new Date(Date.now() - HOUR),
      seller: seller._id,
      settledAt: new Date(Date.now() - HOUR),
      outcome: "sold",
      isSold: true,
      winner: buyer._id,
      bids: [{ bidder: buyer._id, bidAmount: 1200 }],
      ...overrides,
    });

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Review.init();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      [Product, User, Review, Notification].map((m) => m.deleteMany({})),
    );
    const make = (name) =>
      User.create({ name, email: `${name}@t.test`, password: "x".repeat(8) });
    [seller, buyer, other] = await Promise.all(["Kabir", "Meera", "Asha"].map(make));
  });

  test("winner rates the seller and the seller is notified", async () => {
    const sale = await lot();
    const res = await call(reviewAuction, {
      id: sale._id.toString(),
      user: as(buyer),
      body: { rating: 5, comment: "Packed with care" },
    });
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.review.role, "buyer");

    const saved = await Review.findOne({ auction: sale._id });
    assert.equal(saved.reviewee.toString(), seller._id.toString());

    const [note] = await Notification.find({ user: seller._id, type: "review" });
    assert.equal(note.message, "Meera rated you 5 stars for Brass lamp.");
  });

  test("seller rates the winner", async () => {
    const sale = await lot();
    const res = await call(reviewAuction, {
      id: sale._id.toString(),
      user: as(seller),
      body: { rating: 1 },
    });
    assert.equal(res.statusCode, 201);
    const saved = await Review.findOne({ auction: sale._id });
    assert.equal(saved.reviewee.toString(), buyer._id.toString());
    assert.equal(saved.role, "seller");
    const [note] = await Notification.find({ user: buyer._id });
    assert.match(note.message, /1 star for/);
  });

  test("a second review of the same sale is refused", async () => {
    const sale = await lot();
    const send = () =>
      call(reviewAuction, { id: sale._id.toString(), user: as(buyer), body: { rating: 4 } });
    assert.equal((await send()).statusCode, 201);
    const again = await send();
    assert.equal(again.statusCode, 409);
    assert.equal(await Review.countDocuments(), 1);
  });

  test("simultaneous reviews by one person save only one", async () => {
    const sale = await lot();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        submitReview({ auctionId: sale._id, userId: buyer._id.toString(), rating: 5 }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await Review.countDocuments(), 1);
  });

  test("losing bidders, outsiders and unsold lots are refused", async () => {
    const sale = await lot();
    const outsider = await call(reviewAuction, {
      id: sale._id.toString(),
      user: as(other),
      body: { rating: 5 },
    });
    assert.equal(outsider.statusCode, 403);

    const unsold = await lot({ outcome: "reserve_not_met", winner: null, isSold: false });
    const res = await call(reviewAuction, {
      id: unsold._id.toString(),
      user: as(seller),
      body: { rating: 5 },
    });
    assert.equal(res.statusCode, 403);

    const open = await lot({ settledAt: null, outcome: null, itemEndDate: new Date(Date.now() + HOUR) });
    const early = await call(reviewAuction, {
      id: open._id.toString(),
      user: as(buyer),
      body: { rating: 5 },
    });
    assert.equal(early.statusCode, 403);
    assert.equal(await Review.countDocuments(), 0);
  });

  test("bad input returns 400 and unknown lots 404", async () => {
    const sale = await lot();
    const bad = await call(reviewAuction, {
      id: sale._id.toString(),
      user: as(buyer),
      body: { rating: 9 },
    });
    assert.equal(bad.statusCode, 400);
    const noBody = await call(reviewAuction, { id: sale._id.toString(), user: as(buyer) });
    assert.equal(noBody.statusCode, 400);

    for (const id of [oid().toString(), "nope"]) {
      const res = await call(reviewAuction, { id, user: as(buyer), body: { rating: 5 } });
      assert.equal(res.statusCode, 404);
    }
  });

  test("seller trust counts only buyer ratings and sold lots", async () => {
    const buyers = await Promise.all(
      ["b1", "b2", "b3"].map((n) =>
        User.create({ name: n, email: `${n}@t.test`, password: "x".repeat(8) }),
      ),
    );
    const sales = await Promise.all(buyers.map((b) => lot({ winner: b._id })));
    await lot({ outcome: "no_bids", winner: null, isSold: false, bids: [] });

    for (const [i, rating] of [5, 4, 4].entries()) {
      await submitReview({ auctionId: sales[i]._id, userId: buyers[i]._id.toString(), rating });
    }
    // The seller rating a buyer must not count towards the seller's own score
    await submitReview({ auctionId: sales[0]._id, userId: seller._id.toString(), rating: 1 });

    assert.deepEqual(await getSellerTrust(seller._id), {
      averageRating: 4.3,
      ratingCount: 3,
      completedSales: 3,
      verified: true,
    });
  });

  test("lot page carries seller trust and the viewer's review state", async () => {
    const sale = await lot();
    const id = sale._id.toString();

    const before = await call(auctionById, { id, user: as(buyer) });
    assert.equal(before.statusCode, 200);
    assert.deepEqual(before.body.sellerTrust, {
      averageRating: null,
      ratingCount: 0,
      completedSales: 1,
      verified: false,
    });
    assert.equal(before.body.review.canReview, true);
    assert.equal(before.body.review.role, "buyer");

    await submitReview({ auctionId: id, userId: buyer._id.toString(), rating: 4, comment: "Good" });

    const after = await call(auctionById, { id, user: as(buyer) });
    assert.equal(after.body.review.canReview, false);
    assert.equal(after.body.review.myReview.rating, 4);
    assert.equal(after.body.sellerTrust.averageRating, 4);

    const sellerView = await call(auctionById, { id, user: as(seller) });
    assert.equal(sellerView.body.review.canReview, true);
    assert.equal(sellerView.body.review.theirReview.comment, "Good");

    // A watcher can see the page but has nothing to review
    await User.updateOne({ _id: other._id }, { $addToSet: { watchlist: sale._id } });
    const watcher = await call(auctionById, { id, user: as(other) });
    assert.equal(watcher.statusCode, 200);
    assert.equal(watcher.body.review.canReview, false);
    assert.equal(watcher.body.sellerTrust.ratingCount, 1);
  });
});
