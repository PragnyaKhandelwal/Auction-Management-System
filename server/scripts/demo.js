// One-command local demo: in-memory MongoDB plus sample data. Nothing to configure,
// and all data is discarded on exit. Run with: npm run demo
import os from "node:os";
import path from "node:path";
import bcrypt from "bcrypt";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(
  os.homedir(),
  ".cache",
  "mongodb-binaries",
);

const mongo = await MongoMemoryServer.create();
process.env.MONGO_URL = mongo.getUri("boli");
process.env.JWT_SECRET ??= "local-demo-secret";
process.env.ORIGIN ??= "http://localhost:5173";
process.env.NODE_ENV ??= "development";

const PASSWORD = "demo1234";
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Self-contained catalogue artwork, so the demo needs no image hosting
const art = (emoji, from, to) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/><text x="300" y="255" font-size="170" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const seed = async () => {
  const { default: User } = await import("../models/user.model.js");
  const { default: Product } = await import("../models/product.model.js");

  const password = await bcrypt.hash(PASSWORD, 10);
  const person = (name, role, ipAddress) => ({
    name,
    email: `${name.toLowerCase()}@demo.test`,
    password,
    role,
    ipAddress,
  });
  const [, asha, rohan, meera, kabir, vikram] = await User.create([
    person("Admin", "admin", "10.0.0.1"),
    person("Asha", "user", "10.0.0.2"),
    person("Rohan", "user", "10.0.0.3"),
    person("Meera", "user", "10.0.0.4"),
    person("Kabir", "user", "10.0.0.5"),
    person("Vikram", "user", "10.0.0.5"), // Same IP as Kabir, for the fair-play demo
  ]);

  const now = Date.now();
  const lot = (name, emoji, colors, category, description, fields) => ({
    itemName: name,
    itemDescription: description,
    itemCategory: category,
    itemImage: { public_id: "demo", url: art(emoji, ...colors) },
    itemStartDate: new Date(now - HOUR),
    itemEndDate: new Date(now + 2 * DAY),
    currentPrice: fields.startingPrice,
    ...fields,
  });
  const history = (entries) =>
    entries.map(([bidder, bidAmount, minutesAgo]) => ({
      bidder: bidder._id,
      bidAmount,
      bidTime: new Date(now - minutesAgo * MINUTE),
    }));

  await Product.create([
    lot(
      "HMT Janata hand-wound watch, 1978",
      "⌚",
      ["#fde68a", "#f59e0b"],
      "Collectibles",
      "Serviced last year and keeps good time. Original dial with light patina on the case back.",
      {
        startingPrice: 2500,
        currentPrice: 4200,
        seller: asha._id,
        buyNowPrice: 12000,
        reservePrice: 4000,
        highBidder: rohan._id,
        bids: history([
          [meera, 2500, 50],
          [rohan, 3000, 42],
          [meera, 3600, 25],
          [rohan, 4200, 9],
        ]),
        proxyBids: [
          { bidder: meera._id, maxAmount: 3600 },
          { bidder: rohan._id, maxAmount: 4200 },
        ],
      },
    ),
    lot(
      "Mysore silk saree, handwoven",
      "🥻",
      ["#fecdd3", "#be123c"],
      "Clothing",
      "Unworn, kept in muslin. Pure zari border. Closing soon, so a late bid will trigger the anti-snipe extension.",
      {
        startingPrice: 6000,
        currentPrice: 7500,
        seller: meera._id,
        itemEndDate: new Date(now + 4 * MINUTE),
        highBidder: asha._id,
        bids: history([
          [kabir, 6000, 30],
          [asha, 7500, 6],
        ]),
        proxyBids: [
          { bidder: kabir._id, maxAmount: 6000 },
          { bidder: asha._id, maxAmount: 7500 },
        ],
      },
    ),
    lot(
      "Brass Nataraja statue, 14 inch",
      "🔱",
      ["#fed7aa", "#c2410c"],
      "Antiques",
      "Falling-price sale: the price drops every minute. The first person to accept wins it.",
      {
        format: "dutch",
        startingPrice: 18000,
        dutchFloor: 9000,
        dutchDropAmount: 150,
        dutchDropMinutes: 1,
        itemStartDate: new Date(now - 5 * MINUTE),
        seller: rohan._id,
      },
    ),
    lot(
      "First-edition Malgudi Days",
      "📚",
      ["#ddd6fe", "#6d28d9"],
      "Books",
      "Sealed-bid sale: nobody can see the other bids. The highest bidder wins and pays the second-highest amount.",
      {
        format: "sealed",
        startingPrice: 3000,
        seller: kabir._id,
        sealedBidCount: 2,
        sealedBids: [
          { bidder: asha._id, amount: 5200, placedAt: new Date(now - HOUR) },
          { bidder: rohan._id, amount: 6100, placedAt: new Date(now - HOUR) },
        ],
      },
    ),
    lot(
      "Royal Enfield Bullet 350, 1994",
      "🏍️",
      ["#bfdbfe", "#1d4ed8"],
      "Vehicles",
      "Runs well with clean papers. The hidden reserve has not been met yet.",
      {
        startingPrice: 60000,
        reservePrice: 95000,
        seller: asha._id,
        highBidder: kabir._id,
        currentPrice: 72000,
        bids: history([[kabir, 72000, 90]]),
        proxyBids: [{ bidder: kabir._id, maxAmount: 72000 }],
      },
    ),
    lot(
      "Sitar by a Miraj maker",
      "🎶",
      ["#bbf7d0", "#047857"],
      "Musical Instruments",
      "Tun wood with a full set of new strings. Sealed-bid sale with a reserve.",
      {
        format: "sealed",
        startingPrice: 15000,
        reservePrice: 22000,
        seller: meera._id,
      },
    ),
  ]);

  // Closed history with a shill pattern for the admin Fair Play monitor
  const closed = (name, seller, loser, winner, price) => ({
    ...lot(name, "🖼️", ["#e7e5e4", "#78716c"], "Art", "Closed sample lot.", {
      startingPrice: 500,
      currentPrice: price,
      seller: seller._id,
    }),
    itemStartDate: new Date(now - 6 * DAY),
    itemEndDate: new Date(now - 4 * DAY),
    settledAt: new Date(now - 4 * DAY),
    outcome: "sold",
    isSold: true,
    winner: winner._id,
    highBidder: winner._id,
    bids: [
      ...[1, 2, 3, 4, 5].map((i) => ({
        bidder: loser._id,
        bidAmount: 500 + i * 100,
        bidTime: new Date(now - 5 * DAY + i * HOUR),
      })),
      {
        bidder: winner._id,
        bidAmount: price,
        bidTime: new Date(now - 5 * DAY + 6 * HOUR),
      },
    ],
  });
  await Product.create([
    closed("Madhubani panel", kabir, vikram, meera, 1200),
    closed("Tanjore miniature", kabir, vikram, asha, 1400),
    closed("Warli wall hanging", kabir, vikram, rohan, 1300),
  ]);
};

// The worker and socket server start inside server.js
await import("../server.js");
await seed();

console.log(`
Boli demo is ready. Now start the client:  cd client && npm run dev

Log in at http://localhost:5173 with password "${PASSWORD}":
  admin@demo.test   (admin: try the Fair Play monitor)
  asha@demo.test  rohan@demo.test  meera@demo.test  kabir@demo.test  vikram@demo.test

Data lives in memory and is gone when you stop this process.
`);
