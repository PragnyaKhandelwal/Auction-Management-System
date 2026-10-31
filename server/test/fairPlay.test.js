import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeFairPlay } from "../services/fairPlay.js";

const seller = { _id: "s", name: "Seller", ipAddress: "1.1.1.1" };
const shill = { _id: "x", name: "Shill", ipAddress: "2.2.2.2" };
const buyer = { _id: "b", name: "Buyer", ipAddress: "3.3.3.3" };

const bid = (bidder, minutes, isAuto = false) => ({
  bidder,
  isAuto,
  bidTime: new Date(minutes * 60000),
});

const lot = (id, bids, winner = buyer) => ({
  _id: id,
  itemName: `Lot ${id}`,
  seller,
  bids,
  winner,
  settledAt: new Date(),
});

const types = (flags) => flags.map((f) => f.type);

test("a normal auction raises no flags", () => {
  const flags = analyzeFairPlay([
    lot("1", [bid(shill, 1), bid(buyer, 5), bid(shill, 9), bid(buyer, 14)]),
  ]);
  assert.deepEqual(flags, []);
});

test("repeat underbidder on one seller is flagged high", () => {
  const flags = analyzeFairPlay([
    lot("1", [bid(shill, 1), bid(buyer, 5)]),
    lot("2", [bid(shill, 1), bid(buyer, 5)]),
    lot("3", [bid(shill, 1), bid(buyer, 5)]),
  ]);
  assert.deepEqual(types(flags), ["repeat_underbidder"]);
  assert.equal(flags[0].severity, "high");
  assert.equal(flags[0].auctions.length, 3);
});

test("a bidder who sometimes wins is not a repeat underbidder", () => {
  const flags = analyzeFairPlay([
    lot("1", [bid(shill, 1), bid(buyer, 5)]),
    lot("2", [bid(shill, 1), bid(buyer, 5)]),
    lot("3", [bid(shill, 1), bid(buyer, 5)]),
    lot("4", [bid(shill, 1)], shill),
  ]);
  assert.deepEqual(flags, []);
});

test("dominating an auction and losing is flagged", () => {
  const bids = [1, 5, 9, 13, 17].map((m) => bid(shill, m));
  const flags = analyzeFairPlay([lot("1", [...bids, bid(buyer, 20)])]);
  assert.deepEqual(types(flags), ["price_pusher"]);
});

test("automatic proxy rows do not count against a bidder", () => {
  const bids = [1, 5, 9, 13, 17].map((m) => bid(shill, m, true));
  const flags = analyzeFairPlay([lot("1", [...bids, bid(buyer, 20)])]);
  assert.deepEqual(flags, []);
});

test("bids seconds apart are flagged as rapid-fire", () => {
  const fast = [0, 0.05, 0.1, 0.15].map((m) => bid(buyer, m));
  const flags = analyzeFairPlay([lot("1", fast)]);
  assert.deepEqual(types(flags), ["rapid_fire"]);
});

test("bidder sharing the seller's IP is flagged for review", () => {
  const twin = { _id: "t", name: "Twin", ipAddress: "1.1.1.1" };
  const flags = analyzeFairPlay([lot("1", [bid(twin, 1), bid(buyer, 5)])]);
  assert.deepEqual(types(flags), ["shared_ip"]);
  assert.equal(flags[0].severity, "medium");
});

test("localhost addresses never count as a shared IP", () => {
  const localSeller = { _id: "s", name: "Seller", ipAddress: "::1" };
  const twin = { _id: "t", name: "Twin", ipAddress: "::1" };
  const flags = analyzeFairPlay([
    { ...lot("1", [bid(twin, 1), bid(buyer, 5)]), seller: localSeller },
  ]);
  assert.deepEqual(flags, []);
});
