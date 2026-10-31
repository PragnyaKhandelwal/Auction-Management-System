import "./setup.js";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import {
  buyAuction,
  placeBid,
  remindWatchers,
  settleAuction,
  settleDueAuctions,
  toPublicAuction,
} from "../services/bidding.service.js";

let mongo;
let seller, asha, rohan, meera;

const HOUR = 60 * 60 * 1000;

const makeLot = (overrides = {}) =>
  Product.create({
    itemName: "Test lot",
    itemDescription: "A lot",
    itemCategory: "Art",
    itemImage: { public_id: "x", url: "http://x" },
    startingPrice: 1000,
    currentPrice: 1000,
    itemStartDate: new Date(Date.now() - HOUR),
    itemEndDate: new Date(Date.now() + HOUR),
    seller: seller._id,
    ...overrides,
  });

const bid = (lot, user, amount, maxBid = null) =>
  placeBid({
    auctionId: lot._id.toString(),
    userId: user._id.toString(),
    userName: user.name,
    amount,
    maxBid,
  });

const expire = (lot) =>
  Product.updateOne(
    { _id: lot._id },
    { $set: { itemEndDate: new Date(Date.now() - 1000) } },
  );

const notesFor = (user, type) => Notification.find({ user: user._id, type });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Product.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    Product.deleteMany({}),
    User.deleteMany({}),
    Notification.deleteMany({}),
  ]);
  [seller, asha, rohan, meera] = await User.create(
    ["Seller", "Asha", "Rohan", "Meera"].map((name) => ({
      name,
      email: `${name}@test.com`,
      password: "x",
    })),
  );
});

test("seller cannot bid on their own lot", async () => {
  const lot = await makeLot();
  await assert.rejects(bid(lot, seller, 1000), /own auction/);
});

test("bids before the start time are refused", async () => {
  const lot = await makeLot({ itemStartDate: new Date(Date.now() + HOUR) });
  await assert.rejects(bid(lot, asha, 1000), /not started/);
});

test("large bids are allowed: no more Rs 10 ceiling", async () => {
  const lot = await makeLot();
  const { auction } = await bid(lot, asha, 25000);
  assert.equal(auction.currentPrice, 25000);
});

test("proxy war stops one step above the loser's limit", async () => {
  const lot = await makeLot();
  await bid(lot, asha, 1000, 3000);
  const { auction, outbidImmediately } = await bid(lot, rohan, 1500);
  assert.equal(outbidImmediately, true);
  assert.equal(auction.currentPrice, 1525);
  assert.equal(auction.highBidder.toString(), asha._id.toString());
  assert.equal((await notesFor(asha, "outbid")).length, 0);

  const second = await bid(lot, rohan, 2000, 8000);
  assert.equal(second.auction.currentPrice, 3100);
  assert.equal(second.auction.highBidder.toString(), rohan._id.toString());
  assert.equal((await notesFor(asha, "outbid")).length, 1);
});

test("public view never leaks ceilings, sealed amounts or the reserve", async () => {
  const lot = await makeLot({ reservePrice: 9000 });
  await bid(lot, asha, 1000, 7777);
  const doc = await Product.findById(lot._id).select("+proxyBids +sealedBids");
  const pub = toPublicAuction(doc);
  const text = JSON.stringify(pub);
  assert.ok(!text.includes("7777"));
  assert.ok(!text.includes("9000"));
  assert.equal(pub.hasReserve, true);
  assert.equal(pub.reserveMet, false);

  const own = toPublicAuction(doc, asha._id.toString());
  assert.equal(own.myMaxBid, 7777);
  assert.equal(own.reservePrice, undefined);
  assert.equal(
    toPublicAuction(doc, seller._id.toString()).reservePrice,
    9000,
  );
});

test("20 simultaneous bids: all consistent, price matches the top row", async () => {
  const lot = await makeLot({ startingPrice: 1000, currentPrice: 1000 });
  const users = await User.create(
    Array.from({ length: 20 }, (_, i) => ({
      name: `U${i}`,
      email: `u${i}@test.com`,
      password: "x",
    })),
  );
  const results = await Promise.allSettled(
    users.map((u, i) => bid(lot, u, 2000 + i * 200)),
  );
  const accepted = results.filter((r) => r.status === "fulfilled").length;
  assert.ok(accepted >= 1);

  const final = await Product.findById(lot._id);
  const top = Math.max(...final.bids.map((b) => b.bidAmount));
  assert.equal(final.currentPrice, top);
  assert.equal(final.bidSeq, accepted);
  assert.equal(final.bids.length, accepted);
  for (const r of results.filter((x) => x.status === "rejected")) {
    assert.match(r.reason.message, /at least|busy/);
  }
});

test("a bid in the last two minutes extends the auction", async () => {
  const lot = await makeLot({ itemEndDate: new Date(Date.now() + 30000) });
  const { auction } = await bid(lot, asha, 1000);
  assert.ok(new Date(auction.itemEndDate) - Date.now() > 110000);
  assert.equal(auction.extensions, 1);
});

test("a bid with plenty of time left does not extend", async () => {
  const lot = await makeLot();
  const { auction } = await bid(lot, asha, 1000);
  assert.equal(auction.extensions, 0);
  assert.equal(
    new Date(auction.itemEndDate).getTime(),
    lot.itemEndDate.getTime(),
  );
});

test("worker settles a finished auction without anyone visiting it", async () => {
  const lot = await makeLot();
  await bid(lot, asha, 1000);
  await bid(lot, rohan, 1200);
  await expire(lot);

  assert.equal(await settleDueAuctions(), 1);

  const done = await Product.findById(lot._id);
  assert.equal(done.outcome, "sold");
  assert.equal(done.winner.toString(), rohan._id.toString());
  assert.equal((await notesFor(rohan, "won")).length, 1);
  assert.equal((await notesFor(seller, "sold")).length, 1);
  assert.equal((await notesFor(asha, "lost")).length, 1);
});

test("settling twice at once announces only one result", async () => {
  const lot = await makeLot();
  await bid(lot, asha, 1000);
  await expire(lot);
  await Promise.all([settleAuction(lot._id), settleAuction(lot._id)]);
  assert.equal((await notesFor(asha, "won")).length, 1);
});

test("reserve not met: no winner, seller told", async () => {
  const lot = await makeLot({ reservePrice: 5000 });
  await bid(lot, asha, 1000);
  await expire(lot);
  await settleDueAuctions();
  const done = await Product.findById(lot._id);
  assert.equal(done.outcome, "reserve_not_met");
  assert.equal(done.winner, null);
  assert.equal((await notesFor(seller, "unsold")).length, 1);
});

test("no bids: closes as unsold", async () => {
  const lot = await makeLot();
  await expire(lot);
  await settleDueAuctions();
  assert.equal((await Product.findById(lot._id)).outcome, "no_bids");
});

test("bids after the end time are refused", async () => {
  const lot = await makeLot();
  await expire(lot);
  await assert.rejects(bid(lot, asha, 1000), /already ended/);
});

test("Buy Now ends the auction at once", async () => {
  const lot = await makeLot({ buyNowPrice: 5000 });
  await bid(lot, asha, 1000);
  const { auction, price } = await buyAuction({
    auctionId: lot._id.toString(),
    userId: rohan._id.toString(),
  });
  assert.equal(price, 5000);
  assert.equal(auction.outcome, "sold");
  assert.equal(auction.winner.name, "Rohan");
  assert.equal((await notesFor(asha, "lost")).length, 1);
  await assert.rejects(bid(lot, meera, 6000), /already ended/);
});

test("Buy Now disappears once bidding passes it", async () => {
  const lot = await makeLot({ buyNowPrice: 2000 });
  await bid(lot, asha, 2500);
  await assert.rejects(
    buyAuction({
      auctionId: lot._id.toString(),
      userId: rohan._id.toString(),
    }),
    /passed the Buy Now/,
  );
});

test("Dutch: first to accept wins at the live price, second is refused", async () => {
  const lot = await makeLot({
    format: "dutch",
    dutchFloor: 500,
    dutchDropAmount: 100,
    dutchDropMinutes: 20, // One hour in: 3 drops
  });
  const accept = (user) =>
    buyAuction({
      auctionId: lot._id.toString(),
      userId: user._id.toString(),
    });
  const [a, b] = await Promise.allSettled([accept(asha), accept(rohan)]);
  const wins = [a, b].filter((r) => r.status === "fulfilled");
  assert.equal(wins.length, 1);
  assert.equal(wins[0].value.price, 700);
  assert.equal((await Product.findById(lot._id)).bids.length, 1);
});

test("Dutch auctions do not accept ordinary bids", async () => {
  const lot = await makeLot({
    format: "dutch",
    dutchFloor: 500,
    dutchDropAmount: 100,
    dutchDropMinutes: 20,
  });
  await assert.rejects(bid(lot, asha, 900), /accepting the live price/);
});

test("Sealed: amounts hidden while open, Vickrey price at close", async () => {
  const lot = await makeLot({ format: "sealed" });
  const first = await bid(lot, asha, 4000);
  assert.equal(first.auction.mySealedBid, 4000);
  await bid(lot, rohan, 9000);
  await bid(lot, meera, 6000);
  await bid(lot, meera, 6500); // A bidder may change their own bid

  const open = await Product.findById(lot._id);
  assert.equal(open.bids.length, 0);
  assert.equal(open.currentPrice, 1000);
  assert.equal(open.sealedBidCount, 3);
  assert.ok(!JSON.stringify(toPublicAuction(open)).includes("9000"));

  await expire(lot);
  await settleDueAuctions();
  const done = await Product.findById(lot._id);
  assert.equal(done.winner.toString(), rohan._id.toString());
  assert.equal(done.currentPrice, 6500);
  assert.equal(done.bids.length, 3);
});

test("watchers are reminded once when a lot is about to close", async () => {
  const lot = await makeLot({ itemEndDate: new Date(Date.now() + 5 * 60000) });
  await User.updateOne({ _id: asha._id }, { $set: { watchlist: [lot._id] } });
  await remindWatchers();
  await remindWatchers();
  assert.equal((await notesFor(asha, "ending_soon")).length, 1);
  assert.equal((await notesFor(rohan, "ending_soon")).length, 0);
});
