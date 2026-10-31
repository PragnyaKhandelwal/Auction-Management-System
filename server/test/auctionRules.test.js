import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dutchPriceAt,
  extendedEndDate,
  minIncrement,
  nextMinimumBid,
  resolveEnglishBid,
  settleEnglish,
  settleSealed,
  validateListing,
} from "../services/auctionRules.js";

const base = {
  currentPrice: 1000,
  startingPrice: 1000,
  hasBids: false,
  reservePrice: null,
  leaderId: null,
  proxyBids: [],
};

test("bid step grows with price", () => {
  assert.equal(minIncrement(100), 10);
  assert.equal(minIncrement(1999), 25);
  assert.equal(minIncrement(2000), 100);
  assert.equal(minIncrement(60000), 1000);
});

test("first bid may equal the starting price, later bids must step up", () => {
  assert.equal(nextMinimumBid(base), 1000);
  assert.equal(nextMinimumBid({ ...base, hasBids: true }), 1025);
});

test("bid below the minimum is rejected", () => {
  const r = resolveEnglishBid({
    ...base,
    hasBids: true,
    leaderId: "a",
    bidderId: "b",
    amount: 1010,
  });
  assert.match(r.error, /at least Rs 1025/);
});

test("auto-bid beats a plain bid by one step, and no more", () => {
  const r = resolveEnglishBid({
    ...base,
    currentPrice: 1200,
    hasBids: true,
    leaderId: "a",
    proxyBids: [{ bidder: "a", maxAmount: 2000 }],
    bidderId: "b",
    amount: 1300,
  });
  assert.equal(r.leaderId, "a");
  assert.equal(r.price, 1325);
  assert.equal(r.outbidImmediately, true);
  assert.deepEqual(r.rows.map((x) => x.isAuto), [false, true]);
});

test("auto-bid never spends past its own ceiling", () => {
  const r = resolveEnglishBid({
    ...base,
    currentPrice: 1200,
    hasBids: true,
    leaderId: "a",
    proxyBids: [{ bidder: "a", maxAmount: 1310 }],
    bidderId: "b",
    amount: 1300,
  });
  assert.equal(r.leaderId, "a");
  assert.equal(r.price, 1310);
});

test("equal ceilings: the earlier bidder keeps the lead", () => {
  const r = resolveEnglishBid({
    ...base,
    currentPrice: 1200,
    hasBids: true,
    leaderId: "a",
    proxyBids: [{ bidder: "a", maxAmount: 1500 }],
    bidderId: "b",
    amount: 1500,
  });
  assert.equal(r.leaderId, "a");
  assert.equal(r.price, 1500);
});

test("higher ceiling takes the lead one step above the rival's limit", () => {
  const r = resolveEnglishBid({
    ...base,
    currentPrice: 1200,
    hasBids: true,
    leaderId: "a",
    proxyBids: [{ bidder: "a", maxAmount: 1500 }],
    bidderId: "b",
    amount: 1300,
    maxBid: 5000,
  });
  assert.equal(r.leaderId, "b");
  assert.equal(r.price, 1525);
  assert.equal(r.leaderChanged, true);
  assert.equal(r.rows[0].bidder, "a");
  assert.equal(r.rows[0].bidAmount, 1500);
});

test("leader cannot bid against themselves but can raise their limit silently", () => {
  const state = {
    ...base,
    currentPrice: 1200,
    hasBids: true,
    leaderId: "a",
    proxyBids: [{ bidder: "a", maxAmount: 1500 }],
    bidderId: "a",
    amount: 1300,
  };
  assert.match(resolveEnglishBid(state).error, /already the highest/);
  const raised = resolveEnglishBid({ ...state, maxBid: 3000 });
  assert.equal(raised.price, 1200);
  assert.equal(raised.ceilingOnly, true);
  assert.equal(raised.proxyBids[0].maxAmount, 3000);
});

test("a ceiling that clears the hidden reserve jumps the price to it", () => {
  const r = resolveEnglishBid({
    ...base,
    reservePrice: 4000,
    bidderId: "a",
    amount: 1000,
    maxBid: 6000,
  });
  assert.equal(r.price, 4000);
});

test("a ceiling below the reserve does not reveal or reach it", () => {
  const r = resolveEnglishBid({
    ...base,
    reservePrice: 4000,
    bidderId: "a",
    amount: 1000,
    maxBid: 3000,
  });
  assert.equal(r.price, 1000);
});

test("Dutch price falls in steps and stops at the floor", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const lot = {
    startingPrice: 1000,
    dutchFloor: 700,
    dutchDropAmount: 100,
    dutchDropMinutes: 10,
    itemStartDate: start,
  };
  const at = (min) => new Date(start.getTime() + min * 60000);
  assert.equal(dutchPriceAt(lot, at(-5)), 1000);
  assert.equal(dutchPriceAt(lot, at(9)), 1000);
  assert.equal(dutchPriceAt(lot, at(10)), 900);
  assert.equal(dutchPriceAt(lot, at(25)), 800);
  assert.equal(dutchPriceAt(lot, at(500)), 700);
});

test("Sealed winner pays the second-highest bid", () => {
  const r = settleSealed({
    startingPrice: 100,
    reservePrice: null,
    sealedBids: [
      { bidder: "a", amount: 500, placedAt: new Date(1) },
      { bidder: "b", amount: 900, placedAt: new Date(2) },
      { bidder: "c", amount: 700, placedAt: new Date(3) },
    ],
  });
  assert.equal(r.winner, "b");
  assert.equal(r.finalPrice, 700);
});

test("Sealed: a lone bidder pays the starting price or reserve", () => {
  const sealedBids = [{ bidder: "a", amount: 900, placedAt: new Date(1) }];
  assert.equal(
    settleSealed({ sealedBids, startingPrice: 100 }).finalPrice,
    100,
  );
  assert.equal(
    settleSealed({ sealedBids, startingPrice: 100, reservePrice: 400 })
      .finalPrice,
    400,
  );
});

test("Sealed: tied bids go to the earlier bidder", () => {
  const r = settleSealed({
    startingPrice: 100,
    sealedBids: [
      { bidder: "late", amount: 500, placedAt: new Date(9) },
      { bidder: "early", amount: 500, placedAt: new Date(1) },
    ],
  });
  assert.equal(r.winner, "early");
  assert.equal(r.finalPrice, 500);
});

test("reserve not met means no sale", () => {
  assert.equal(
    settleSealed({
      startingPrice: 100,
      reservePrice: 1000,
      sealedBids: [{ bidder: "a", amount: 900, placedAt: new Date(1) }],
    }).outcome,
    "reserve_not_met",
  );
  assert.equal(
    settleEnglish({
      bids: [{ bidder: "a", bidAmount: 900 }],
      highBidder: "a",
      currentPrice: 900,
      reservePrice: 1000,
    }).outcome,
    "reserve_not_met",
  );
});

test("older auctions without highBidder settle to the top bid", () => {
  const r = settleEnglish({
    bids: [
      { bidder: "a", bidAmount: 100, bidTime: new Date(1) },
      { bidder: "b", bidAmount: 200, bidTime: new Date(2) },
    ],
    highBidder: null,
    currentPrice: 200,
    reservePrice: null,
  });
  assert.equal(r.winner, "b");
});

test("soft close only extends inside the last two minutes, up to a limit", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const inMinutes = (m) => new Date(now.getTime() + m * 60000);
  assert.equal(extendedEndDate({ itemEndDate: inMinutes(5) }, now), null);
  assert.deepEqual(
    extendedEndDate({ itemEndDate: inMinutes(1) }, now),
    inMinutes(2),
  );
  assert.equal(
    extendedEndDate({ itemEndDate: inMinutes(1), extensions: 15 }, now),
    null,
  );
});

test("listing validation catches bad format options", () => {
  const ok = { format: "english", startingPrice: 100 };
  assert.equal(validateListing(ok), null);
  assert.match(validateListing({ ...ok, format: "x" }), /Unknown/);
  assert.match(validateListing({ ...ok, startingPrice: 1.5 }), /whole/);
  assert.match(validateListing({ ...ok, reservePrice: 50 }), /Reserve/);
  assert.match(validateListing({ ...ok, buyNowPrice: 100 }), /Buy Now/);
  assert.match(
    validateListing({ format: "sealed", startingPrice: 100, buyNowPrice: 500 }),
    /only for English/,
  );
  assert.match(
    validateListing({
      format: "dutch",
      startingPrice: 100,
      dutchFloor: 100,
      dutchDropAmount: 5,
      dutchDropMinutes: 1,
    }),
    /Floor/,
  );
});
