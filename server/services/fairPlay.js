// Rule-based shill-bidding signals for the admin monitor. Flags are prompts for a
// human review, not proof of wrongdoing, so each one explains its own evidence.

const REPEAT_LOSSES_MIN = 3;
const DOMINANCE_MIN_BIDS = 5;
const DOMINANCE_SHARE = 0.6;
const RAPID_GAP_MS = 10 * 1000;
const RAPID_MIN_BIDS = 4;

const idOf = (ref) => (ref?._id ?? ref)?.toString();
const nameOf = (ref) => ref?.name ?? "Unknown";
const isLoopback = (ip) => /^(::1|127\.|::ffff:127\.)/.test(ip);

export const analyzeFairPlay = (auctions) => {
  const flags = [];
  // bidderId:sellerId -> pressure this bidder applied on this seller's lots
  const pairs = new Map();

  for (const auction of auctions) {
    const sellerId = idOf(auction.seller);
    const manualBids = (auction.bids || []).filter((b) => !b.isAuto);
    const byBidder = new Map();
    for (const bid of manualBids) {
      const id = idOf(bid.bidder);
      if (!byBidder.has(id)) byBidder.set(id, []);
      byBidder.get(id).push(bid);
    }

    for (const [bidderId, bids] of byBidder) {
      const bidder = bids[0].bidder;
      const won = idOf(auction.winner) === bidderId;
      const auctionRef = { _id: auction._id, itemName: auction.itemName };

      const key = `${bidderId}:${sellerId}`;
      if (!pairs.has(key)) {
        pairs.set(key, { bidder, seller: auction.seller, lost: [], won: 0 });
      }
      const pair = pairs.get(key);
      if (won) pair.won += 1;
      else if (auction.settledAt) pair.lost.push(auctionRef);

      const share = bids.length / manualBids.length;
      if (
        auction.settledAt &&
        !won &&
        bids.length >= DOMINANCE_MIN_BIDS &&
        share >= DOMINANCE_SHARE
      ) {
        flags.push({
          type: "price_pusher",
          severity: "medium",
          title: "Pushed the price, then lost",
          detail: `${nameOf(bidder)} placed ${bids.length} of ${manualBids.length} bids on "${auction.itemName}" and did not win.`,
          users: [nameOf(bidder)],
          auctions: [auctionRef],
        });
      }

      const times = bids
        .map((b) => new Date(b.bidTime).getTime())
        .sort((a, b) => a - b);
      const rapid = times.filter(
        (t, i) => i > 0 && t - times[i - 1] <= RAPID_GAP_MS,
      ).length;
      if (rapid + 1 >= RAPID_MIN_BIDS) {
        flags.push({
          type: "rapid_fire",
          severity: "low",
          title: "Machine-like bid speed",
          detail: `${nameOf(bidder)} placed ${rapid + 1} bids on "${auction.itemName}" less than ${RAPID_GAP_MS / 1000} seconds apart.`,
          users: [nameOf(bidder)],
          auctions: [auctionRef],
        });
      }

      // Medium only: a home or college network can legitimately share one address
      const sellerIp = auction.seller?.ipAddress;
      if (sellerIp && !isLoopback(sellerIp) && bidder?.ipAddress === sellerIp) {
        flags.push({
          type: "shared_ip",
          severity: "medium",
          title: "Bidder and seller share an IP address",
          detail: `${nameOf(bidder)} bid on "${auction.itemName}" from the same IP as seller ${nameOf(auction.seller)}.`,
          users: [nameOf(bidder), nameOf(auction.seller)],
          auctions: [auctionRef],
        });
      }
    }
  }

  for (const pair of pairs.values()) {
    if (pair.won === 0 && pair.lost.length >= REPEAT_LOSSES_MIN) {
      flags.push({
        type: "repeat_underbidder",
        severity: "high",
        title: "Always bids on one seller, never wins",
        detail: `${nameOf(pair.bidder)} bid on ${pair.lost.length} of ${nameOf(pair.seller)}'s auctions and won none of them.`,
        users: [nameOf(pair.bidder), nameOf(pair.seller)],
        auctions: pair.lost,
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => rank[a.severity] - rank[b.severity]);
};
