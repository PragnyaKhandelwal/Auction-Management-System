// Pure auction rules: no database or socket access, so every rule is unit-testable.

export const FORMATS = ["english", "dutch", "sealed"];

const ANTI_SNIPE_WINDOW_MS = 2 * 60 * 1000;
const MAX_EXTENSIONS = 15;

// Bid step grows with price, so a Rs 50,000 lot does not move in Rs 1 steps
export const minIncrement = (price) => {
  if (price < 500) return 10;
  if (price < 2000) return 25;
  if (price < 10000) return 100;
  if (price < 50000) return 500;
  return 1000;
};

export const nextMinimumBid = ({ currentPrice, startingPrice, hasBids }) =>
  hasBids ? currentPrice + minIncrement(currentPrice) : startingPrice;

// Dutch price falls in fixed steps from the start time and stops at the floor
export const dutchPriceAt = (auction, now = new Date()) => {
  const { startingPrice, dutchFloor, dutchDropAmount, dutchDropMinutes } =
    auction;
  const elapsed = new Date(now) - new Date(auction.itemStartDate);
  if (elapsed <= 0) return startingPrice;
  const steps = Math.floor(elapsed / (dutchDropMinutes * 60 * 1000));
  return Math.max(dutchFloor, startingPrice - steps * dutchDropAmount);
};

// Soft close: a bid in the last two minutes pushes the end time out
export const extendedEndDate = ({ itemEndDate, extensions = 0 }, now) => {
  const end = new Date(itemEndDate);
  if (end - now > ANTI_SNIPE_WINDOW_MS) return null;
  if (extensions >= MAX_EXTENSIONS) return null;
  return new Date(now.getTime() + ANTI_SNIPE_WINDOW_MS);
};

const sameId = (a, b) => a != null && b != null && a.toString() === b.toString();

// Second-price stepping. Given the auction state and one incoming bid, works out
// the new price, the leader, and the bid rows to record. Every bidder's ceiling
// lives in `proxyBids`; a plain bid is simply a ceiling equal to its amount.
export const resolveEnglishBid = ({
  currentPrice,
  startingPrice,
  hasBids,
  reservePrice,
  leaderId,
  proxyBids,
  bidderId,
  amount,
  maxBid,
}) => {
  const ceiling = Math.max(amount, maxBid || 0);
  const others = proxyBids.filter((p) => !sameId(p.bidder, bidderId));
  const mine = proxyBids.find((p) => sameId(p.bidder, bidderId));
  const nextProxies = [...others, { bidder: bidderId, maxAmount: ceiling }];
  const rows = [];

  // The current leader can only raise their ceiling, never bid against themselves
  if (hasBids && sameId(leaderId, bidderId)) {
    if (!maxBid || maxBid <= (mine?.maxAmount ?? currentPrice)) {
      return { error: "You are already the highest bidder" };
    }
    let price = currentPrice;
    if (reservePrice && price < reservePrice && ceiling >= reservePrice) {
      price = reservePrice;
      rows.push({ bidder: bidderId, bidAmount: price, isAuto: true });
    }
    return {
      price,
      leaderId: bidderId,
      rows,
      proxyBids: nextProxies,
      leaderChanged: false,
      ceilingOnly: rows.length === 0,
    };
  }

  const minimum = nextMinimumBid({ currentPrice, startingPrice, hasBids });
  if (amount < minimum) {
    return { error: `Bid must be at least Rs ${minimum}` };
  }
  if (maxBid && maxBid < amount) {
    return { error: "Your auto-bid limit must be at or above your bid" };
  }

  const rival = others.reduce(
    (best, p) => (!best || p.maxAmount > best.maxAmount ? p : best),
    null,
  );

  // An existing ceiling of equal or greater value keeps the lead: earlier bid wins ties
  if (rival && ceiling <= rival.maxAmount) {
    const price = Math.min(rival.maxAmount, ceiling + minIncrement(ceiling));
    rows.push({ bidder: bidderId, bidAmount: ceiling, isAuto: false });
    rows.push({ bidder: rival.bidder, bidAmount: price, isAuto: true });
    return {
      price,
      leaderId: rival.bidder,
      rows,
      proxyBids: nextProxies,
      leaderChanged: false,
      outbidImmediately: true,
    };
  }

  let price = amount;
  if (rival) {
    if (rival.maxAmount > currentPrice) {
      rows.push({
        bidder: rival.bidder,
        bidAmount: rival.maxAmount,
        isAuto: true,
      });
    }
    const stepped = rival.maxAmount + minIncrement(rival.maxAmount);
    price = Math.max(amount, Math.min(ceiling, stepped));
  }
  // A ceiling that clears a hidden reserve jumps straight to it
  if (reservePrice && price < reservePrice && ceiling >= reservePrice) {
    price = reservePrice;
  }
  rows.push({
    bidder: bidderId,
    bidAmount: price,
    isAuto: price !== amount,
  });

  return {
    price,
    leaderId: bidderId,
    rows,
    proxyBids: nextProxies,
    leaderChanged: !sameId(leaderId, bidderId),
  };
};

// Vickrey: highest sealed bid wins but pays the runner-up's amount
export const settleSealed = ({ sealedBids, startingPrice, reservePrice }) => {
  if (sealedBids.length === 0) return { outcome: "no_bids" };
  const ranked = [...sealedBids].sort(
    (a, b) => b.amount - a.amount || new Date(a.placedAt) - new Date(b.placedAt),
  );
  const top = ranked[0];
  if (reservePrice && top.amount < reservePrice) {
    return { outcome: "reserve_not_met" };
  }
  const runnerUp = ranked[1]?.amount ?? 0;
  return {
    outcome: "sold",
    winner: top.bidder,
    finalPrice: Math.max(runnerUp, startingPrice, reservePrice || 0),
  };
};

export const settleEnglish = ({
  bids,
  highBidder,
  currentPrice,
  reservePrice,
}) => {
  if (bids.length === 0) return { outcome: "no_bids" };
  if (reservePrice && currentPrice < reservePrice) {
    return { outcome: "reserve_not_met" };
  }
  // Auctions created before highBidder existed fall back to the top bid
  const winner =
    highBidder ??
    [...bids].sort(
      (a, b) =>
        b.bidAmount - a.bidAmount || new Date(a.bidTime) - new Date(b.bidTime),
    )[0].bidder;
  return { outcome: "sold", winner, finalPrice: currentPrice };
};

const positiveInt = (value) => Number.isInteger(value) && value > 0;

// Checks the format-specific listing options. Returns an error message, or null.
export const validateListing = ({
  format,
  startingPrice,
  reservePrice,
  buyNowPrice,
  dutchFloor,
  dutchDropAmount,
  dutchDropMinutes,
}) => {
  if (!FORMATS.includes(format)) return "Unknown auction format";
  if (!positiveInt(startingPrice)) {
    return "Starting price must be a whole number of rupees";
  }
  if (format === "dutch") {
    if (!positiveInt(dutchFloor) || dutchFloor >= startingPrice) {
      return "Floor price must be below the opening price";
    }
    if (!positiveInt(dutchDropAmount) || !positiveInt(dutchDropMinutes)) {
      return "Set how much the price drops and how often";
    }
    return null;
  }
  if (reservePrice != null && reservePrice !== undefined) {
    if (!positiveInt(reservePrice) || reservePrice < startingPrice) {
      return "Reserve price must be at or above the starting price";
    }
  }
  if (buyNowPrice != null) {
    if (format !== "english") return "Buy Now is only for English auctions";
    if (!positiveInt(buyNowPrice) || buyNowPrice <= startingPrice) {
      return "Buy Now price must be above the starting price";
    }
    if (reservePrice != null && buyNowPrice < reservePrice) {
      return "Buy Now price must be at or above the reserve";
    }
  }
  return null;
};
