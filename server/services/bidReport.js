// Auditable bid logs for sellers and admins. Bidders are never named: a seller's
// lot report labels them B1, B2... in order of first bid, and the admin report
// uses a keyed hash so the same person can be followed across lots.
import crypto from "node:crypto";

export const REPORT_COLUMNS = [
  { key: "lotId", header: "lot_id" },
  { key: "lotName", header: "lot_name" },
  { key: "format", header: "format" },
  { key: "outcome", header: "outcome" },
  { key: "settledAt", header: "settled_at_utc" },
  { key: "finalPrice", header: "final_price_rs" },
  { key: "sequence", header: "bid_sequence" },
  { key: "bidTime", header: "bid_time_utc" },
  { key: "bidder", header: "bidder_id" },
  { key: "amount", header: "amount_rs" },
  { key: "proxy", header: "proxy_bid" },
  { key: "winner", header: "is_winner" },
];

const idOf = (ref) => (ref?._id ?? ref)?.toString() ?? null;
const isoOrEmpty = (date) => (date ? new Date(date).toISOString() : "");

// Labels bidders B1, B2... in the order they first bid on this lot
export const lotPseudonyms = () => {
  const labels = new Map();
  return (bidderId) => {
    if (!labels.has(bidderId)) labels.set(bidderId, `B${labels.size + 1}`);
    return labels.get(bidderId);
  };
};

// Stable across lots for one secret, but not reversible without it
export const stablePseudonyms = (secret) => (bidderId) =>
  `U-${crypto
    .createHmac("sha256", secret)
    .update(bidderId)
    .digest("hex")
    .slice(0, 10)}`;

// One row per bid, oldest first. Ties keep their stored order.
export const bidLogRows = (auction, pseudonymFor = lotPseudonyms()) => {
  const winnerId = idOf(auction.winner);
  const bids = (auction.bids || [])
    .map((bid, index) => ({ bid, index }))
    .sort(
      (a, b) =>
        new Date(a.bid.bidTime) - new Date(b.bid.bidTime) || a.index - b.index,
    );

  return bids.map(({ bid }, i) => {
    const bidderId = idOf(bid.bidder);
    return {
      lotId: idOf(auction._id),
      lotName: auction.itemName,
      format: auction.format ?? "english",
      outcome: auction.outcome ?? "",
      settledAt: isoOrEmpty(auction.settledAt),
      finalPrice: auction.outcome === "sold" ? auction.currentPrice : "",
      sequence: i + 1,
      bidTime: isoOrEmpty(bid.bidTime),
      bidder: bidderId ? pseudonymFor(bidderId) : "",
      amount: bid.bidAmount,
      proxy: bid.isAuto ? "yes" : "no",
      winner: winnerId && bidderId === winnerId ? "yes" : "no",
    };
  });
};

// Spreadsheets run cells that start with these as formulas
const FORMULA_START = /^[=+\-@\t\r]/;

export const csvCell = (value) => {
  if (value == null) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// RFC 4180 lines, with a byte-order mark so Excel reads non-English names
export const toCsv = (rows, columns = REPORT_COLUMNS) => {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c.key])).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
};
