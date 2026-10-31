export const CATEGORIES = [
  "Electronics",
  "Antiques",
  "Art",
  "Books",
  "Clothing",
  "Collectibles",
  "Home & Garden",
  "Jewelry",
  "Musical Instruments",
  "Sports",
  "Toys",
  "Vehicles",
  "Other",
];

export const FORMATS = {
  english: {
    label: "English",
    tagline: "Open bidding, price rises",
    rules:
      "Bids are public and the highest wins. Set an auto-bid limit and Boli bids for you, one step at a time. A bid in the last 2 minutes adds time, so nobody can snipe.",
    badge: "bg-brand-600 text-white",
  },
  dutch: {
    label: "Dutch",
    tagline: "Price falls until someone accepts",
    rules:
      "The price drops on a fixed schedule. The first person to accept wins at that price. Wait for a better deal, but someone may get there first.",
    badge: "bg-amber-500 text-gray-900",
  },
  sealed: {
    label: "Sealed",
    tagline: "Hidden bids, winner pays second price",
    rules:
      "Nobody sees any bid until the close. The highest bidder wins but pays only the second-highest amount, so your best move is to bid what it is truly worth to you.",
    badge: "bg-gray-900 text-white",
  },
};

export const formatRs = (amount) =>
  `Rs ${Number(amount || 0).toLocaleString("en-IN")}`;

export const formatTimeLeft = (ms) => {
  if (ms <= 0) return "Ended";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Under 1m";
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m left`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
};

// Mirrors the server's Dutch schedule so the clock ticks without a request.
// The server recalculates when someone accepts, and its price is the one charged.
export const dutchPriceAt = (auction, now = Date.now()) => {
  const elapsed = now - new Date(auction.itemStartDate).getTime();
  if (elapsed <= 0) return auction.startingPrice;
  const steps = Math.floor(elapsed / (auction.dutchDropMinutes * 60000));
  return Math.max(
    auction.dutchFloor,
    auction.startingPrice - steps * auction.dutchDropAmount,
  );
};

export const msToNextDutchDrop = (auction, now = Date.now()) => {
  const interval = auction.dutchDropMinutes * 60000;
  const elapsed = now - new Date(auction.itemStartDate).getTime();
  if (elapsed < 0) return interval;
  return interval - (elapsed % interval);
};
