import "./setup.js";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import {
  bidLogRows,
  csvCell,
  lotPseudonyms,
  stablePseudonyms,
  toCsv,
} from "../services/bidReport.js";
import { bidReport, auctionById } from "../controllers/auction.controller.js";
import { getSettlementReport } from "../controllers/admin.controller.js";

const HOUR = 60 * 60 * 1000;
const at = (minutes) => new Date(Date.UTC(2026, 10, 1, 10, minutes));
const oid = () => new mongoose.Types.ObjectId();

const parseCsv = (text) => {
  assert.ok(text.startsWith("﻿"), "starts with a byte-order mark");
  const lines = text.slice(1).trimEnd().split("\r\n");
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  });
};

describe("bidLogRows", () => {
  const asha = oid();
  const rohan = oid();
  const lot = {
    _id: oid(),
    itemName: "Brass lamp",
    format: "english",
    outcome: "sold",
    settledAt: at(30),
    currentPrice: 1300,
    winner: rohan,
    // Stored out of order on purpose
    bids: [
      { bidder: rohan, bidAmount: 1200, bidTime: at(5), isAuto: false },
      { bidder: asha, bidAmount: 1100, bidTime: at(1), isAuto: false },
      { bidder: rohan, bidAmount: 1300, bidTime: at(9), isAuto: true },
    ],
  };

  test("lists bids oldest first with sequence numbers", () => {
    const rows = bidLogRows(lot);
    assert.deepEqual(
      rows.map((r) => [r.sequence, r.amount]),
      [
        [1, 1100],
        [2, 1200],
        [3, 1300],
      ],
    );
    assert.equal(rows[0].bidTime, "2026-11-01T10:01:00.000Z");
  });

  test("labels bidders in order of first bid and never exposes their IDs", () => {
    const rows = bidLogRows(lot);
    assert.deepEqual(
      rows.map((r) => r.bidder),
      ["B1", "B2", "B2"],
    );
    const csv = toCsv(rows);
    assert.ok(!csv.includes(asha.toString()));
    assert.ok(!csv.includes(rohan.toString()));
  });

  test("flags proxy bids and the winner's bids", () => {
    const rows = bidLogRows(lot);
    assert.deepEqual(
      rows.map((r) => [r.proxy, r.winner]),
      [
        ["no", "no"],
        ["no", "yes"],
        ["yes", "yes"],
      ],
    );
  });

  test("keeps stored order for bids placed at the same instant", () => {
    const same = at(3);
    const rows = bidLogRows({
      ...lot,
      bids: [
        { bidder: asha, bidAmount: 1100, bidTime: same },
        { bidder: rohan, bidAmount: 1200, bidTime: same, isAuto: true },
      ],
    });
    assert.deepEqual(
      rows.map((r) => r.amount),
      [1100, 1200],
    );
  });

  test("leaves the final price blank when the lot did not sell", () => {
    const rows = bidLogRows({ ...lot, outcome: "reserve_not_met", winner: null });
    assert.equal(rows[0].finalPrice, "");
    assert.ok(rows.every((r) => r.winner === "no"));
  });

  test("works with populated bidder documents", () => {
    const rows = bidLogRows({
      ...lot,
      winner: { _id: rohan, name: "Rohan" },
      bids: [{ bidder: { _id: rohan, name: "Rohan" }, bidAmount: 1, bidTime: at(1) }],
    });
    assert.equal(rows[0].bidder, "B1");
    assert.equal(rows[0].winner, "yes");
  });

  test("returns no rows for a lot without bids", () => {
    assert.deepEqual(bidLogRows({ ...lot, bids: [] }), []);
  });
});

describe("pseudonyms", () => {
  test("lot labels restart for every lot", () => {
    const a = lotPseudonyms();
    const b = lotPseudonyms();
    assert.equal(a("x"), "B1");
    assert.equal(a("y"), "B2");
    assert.equal(a("x"), "B1");
    assert.equal(b("y"), "B1");
  });

  test("stable IDs match across lots and depend on the secret", () => {
    const id = oid().toString();
    const one = stablePseudonyms("secret-1");
    assert.equal(one(id), stablePseudonyms("secret-1")(id));
    assert.notEqual(one(id), stablePseudonyms("secret-2")(id));
    assert.match(one(id), /^U-[0-9a-f]{10}$/);
    assert.notEqual(one(id), one(oid().toString()));
  });
});

describe("CSV output", () => {
  test("quotes commas, quotes and line breaks", () => {
    assert.equal(csvCell('Lamp, "rare"'), '"Lamp, ""rare"""');
    assert.equal(csvCell("two\nlines"), '"two\nlines"');
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(1500), "1500");
  });

  test("defuses text that a spreadsheet would run as a formula", () => {
    assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
    assert.equal(csvCell("+1"), "'+1");
    assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(csvCell("-5"), "'-5");
  });

  test("writes a header row and CRLF line endings", () => {
    const csv = toCsv([]);
    assert.equal(
      csv,
      "﻿lot_id,lot_name,format,outcome,settled_at_utc,final_price_rs," +
        "bid_sequence,bid_time_utc,bidder_id,amount_rs,proxy_bid,is_winner\r\n",
    );
  });

  test("keeps non-English lot names intact", () => {
    const csv = toCsv([{ lotName: "पीतल का दीया" }]);
    assert.ok(csv.includes("पीतल का दीया"));
  });
});

// Minimal Express response double for calling controllers directly
const fakeRes = () => {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (code) => ((res.statusCode = code), res);
  res.type = (t) => ((res.headers["content-type"] = t), res);
  res.attachment = (name) => (
    (res.headers["content-disposition"] = `attachment; filename="${name}"`), res
  );
  res.send = (body) => ((res.body = body), res);
  res.json = (body) => ((res.body = body), res);
  return res;
};

const call = async (handler, { params = {}, user }) => {
  const res = fakeRes();
  await handler({ params, query: {}, user }, res);
  return res;
};

describe("report endpoints", () => {
  let mongo;
  let seller, asha, rohan, admin;

  const as = (u, role = "user") => ({ id: u._id.toString(), role });

  const makeLot = (overrides = {}) =>
    Product.create({
      itemName: "Test lot",
      itemDescription: "A lot",
      itemCategory: "Art",
      itemImage: { public_id: "x", url: "http://x" },
      startingPrice: 1000,
      currentPrice: 1000,
      itemStartDate: new Date(Date.now() - 2 * HOUR),
      itemEndDate: new Date(Date.now() - HOUR),
      seller: seller._id,
      ...overrides,
    });

  const settledLot = (overrides = {}) =>
    makeLot({
      settledAt: new Date(Date.now() - HOUR),
      outcome: "sold",
      isSold: true,
      winner: rohan._id,
      currentPrice: 1200,
      bids: [
        { bidder: asha._id, bidAmount: 1100, bidTime: new Date(Date.now() - 90 * 60 * 1000) },
        { bidder: rohan._id, bidAmount: 1200, bidTime: new Date(Date.now() - 80 * 60 * 1000), isAuto: true },
      ],
      ...overrides,
    });

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([Product.deleteMany({}), User.deleteMany({})]);
    const make = (name) =>
      User.create({ name, email: `${name}@t.test`, password: "x".repeat(8) });
    [seller, asha, rohan, admin] = await Promise.all(
      ["seller", "asha", "rohan", "admin"].map(make),
    );
  });

  test("seller downloads the CSV of a settled lot", async () => {
    const lot = await settledLot();
    const res = await call(bidReport, {
      params: { id: lot._id.toString() },
      user: as(seller),
    });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"], /text\/csv/);
    assert.match(
      res.headers["content-disposition"],
      new RegExp(`boli-lot-${lot._id}-bids\\.csv`),
    );
    const rows = parseCsv(res.body);
    assert.deepEqual(
      rows.map((r) => [r.bid_sequence, r.bidder_id, r.amount_rs, r.proxy_bid, r.is_winner]),
      [
        ["1", "B1", "1100", "no", "no"],
        ["2", "B2", "1200", "yes", "yes"],
      ],
    );
    assert.equal(rows[0].final_price_rs, "1200");
  });

  test("admin can download any settled lot", async () => {
    const lot = await settledLot();
    const res = await call(bidReport, {
      params: { id: lot._id.toString() },
      user: as(admin, "admin"),
    });
    assert.equal(res.statusCode, 200);
  });

  test("bidders and other users are refused", async () => {
    const lot = await settledLot();
    for (const user of [asha, rohan]) {
      const res = await call(bidReport, {
        params: { id: lot._id.toString() },
        user: as(user),
      });
      assert.equal(res.statusCode, 403);
    }
  });

  test("an open lot has no report yet", async () => {
    const lot = await makeLot({ itemEndDate: new Date(Date.now() + HOUR) });
    const res = await call(bidReport, {
      params: { id: lot._id.toString() },
      user: as(seller),
    });
    assert.equal(res.statusCode, 409);
  });

  test("unknown or malformed IDs return 404", async () => {
    for (const id of [oid().toString(), "not-an-id"]) {
      const res = await call(bidReport, { params: { id }, user: as(seller) });
      assert.equal(res.statusCode, 404);
    }
  });

  test("a settled sealed lot reports its revealed bids", async () => {
    const lot = await settledLot({ format: "sealed" });
    const res = await call(bidReport, {
      params: { id: lot._id.toString() },
      user: as(seller),
    });
    const rows = parseCsv(res.body);
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.format === "sealed"));
  });

  test("admin settlement report covers settled lots only, with stable IDs", async () => {
    const first = await settledLot({ itemName: "First" });
    const second = await settledLot({
      itemName: "Second",
      settledAt: new Date(Date.now() - 30 * 60 * 1000),
      winner: asha._id,
      bids: [
        { bidder: rohan._id, bidAmount: 1100, bidTime: new Date(Date.now() - 50 * 60 * 1000) },
        { bidder: asha._id, bidAmount: 1500, bidTime: new Date(Date.now() - 40 * 60 * 1000) },
      ],
    });
    await makeLot({
      itemName: "Still open",
      itemEndDate: new Date(Date.now() + HOUR),
      bids: [{ bidder: asha._id, bidAmount: 1100 }],
    });
    await makeLot({
      itemName: "Settled long ago",
      settledAt: new Date(Date.now() - 200 * 24 * HOUR),
      bids: [{ bidder: asha._id, bidAmount: 1100 }],
    });

    const res = await call(getSettlementReport, { user: as(admin, "admin") });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-disposition"], /boli-settlement-report-\d{4}-\d{2}-\d{2}\.csv/);

    const rows = parseCsv(res.body);
    assert.deepEqual(
      [...new Set(rows.map((r) => r.lot_id))],
      [first._id.toString(), second._id.toString()],
    );

    const idFor = (lotId, amount) =>
      rows.find((r) => r.lot_id === lotId && r.amount_rs === amount).bidder_id;
    // Asha bid 1100 on the first lot and 1500 on the second
    assert.equal(idFor(first._id.toString(), "1100"), idFor(second._id.toString(), "1500"));
    assert.match(rows[0].bidder_id, /^U-[0-9a-f]{10}$/);
    for (const u of [asha, rohan]) {
      assert.ok(!res.body.includes(u._id.toString()));
      assert.ok(!res.body.includes(u.name));
    }
  });

  test("admins can open an ended lot they did not take part in", async () => {
    const lot = await settledLot();
    const params = { id: lot._id.toString() };

    const adminView = await call(auctionById, { params, user: as(admin, "admin") });
    assert.equal(adminView.statusCode, 200);

    const outsider = await User.create({
      name: "outsider",
      email: "o@t.test",
      password: "x".repeat(8),
    });
    const outsiderView = await call(auctionById, { params, user: as(outsider) });
    assert.equal(outsiderView.statusCode, 403);
  });
});
