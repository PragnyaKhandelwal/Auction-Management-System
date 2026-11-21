import "./setup.js";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import Upload from "../models/upload.model.js";
import {
  avatarUrl,
  isRetiredImageUrl,
  listingImageUrl,
  placeholderImage,
} from "../utils/images.js";
import { toPublicAuction } from "../services/bidding.service.js";
import { handleSession } from "../controllers/auth.controller.js";
import { handleGetUser } from "../controllers/user.controller.js";
import { createAuction, showAuction } from "../controllers/auction.controller.js";

const HOUR = 60 * 60 * 1000;
const LIARA = "https://avatar.iran.liara.run/public/7";
const PICSUM = "https://picsum.photos/seed/abc/800/600";
const CLOUDINARY = "https://res.cloudinary.com/demo/image/upload/v1/lamp.jpg";

describe("image helpers", () => {
  test("flags only the retired third-party hosts", () => {
    assert.equal(isRetiredImageUrl(LIARA), true);
    assert.equal(isRetiredImageUrl(PICSUM), true);
    assert.equal(isRetiredImageUrl("https://fastly.picsum.photos/id/386/800/600.jpg"), true);
    assert.equal(isRetiredImageUrl(CLOUDINARY), false);
    assert.equal(isRetiredImageUrl("data:image/svg+xml,abc"), false);
    for (const bad of ["", null, undefined, "not a url", 42]) {
      assert.equal(isRetiredImageUrl(bad), false);
    }
  });

  test("placeholder is a self-contained SVG that differs by category", () => {
    const art = placeholderImage("Books");
    assert.match(art, /^data:image\/svg\+xml,/);
    assert.ok(decodeURIComponent(art).includes("📚"));
    assert.notEqual(art, placeholderImage("Vehicles"));
    assert.equal(placeholderImage("Unknown category"), placeholderImage("Other"));
  });

  test("listing image keeps real uploads and replaces retired or missing ones", () => {
    assert.equal(listingImageUrl({ itemImage: { url: CLOUDINARY } }), CLOUDINARY);
    assert.equal(
      listingImageUrl({ itemImage: { url: PICSUM }, itemCategory: "Art" }),
      placeholderImage("Art"),
    );
    assert.equal(listingImageUrl({ itemCategory: "Toys" }), placeholderImage("Toys"));
    assert.equal(listingImageUrl(), placeholderImage("Other"));
  });

  test("avatar becomes null when retired or missing", () => {
    assert.equal(avatarUrl(LIARA), null);
    assert.equal(avatarUrl(""), null);
    assert.equal(avatarUrl(undefined), null);
    assert.equal(avatarUrl(CLOUDINARY), CLOUDINARY);
  });
});

const fakeRes = () => {
  const res = { statusCode: 200 };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
};

describe("API responses", () => {
  let mongo;
  let user;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([Product, User, Upload].map((m) => m.deleteMany({})));
    user = await User.create({
      name: "Test",
      email: "test@t.test",
      password: "x".repeat(8),
      avatar: LIARA,
    });
  });

  const cookieFor = (u) => jwt.sign({ id: u._id.toString(), role: "user" }, process.env.JWT_SECRET);

  test("session answers 200 with no user when logged out or the token is bad", async () => {
    for (const cookies of [{}, { auth_token: "garbage" }, undefined]) {
      const res = fakeRes();
      await handleSession({ cookies }, res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { user: null });
    }
  });

  test("session returns the signed-in user without the dead avatar", async () => {
    const res = fakeRes();
    await handleSession({ cookies: { auth_token: cookieFor(user) } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.user.name, "Test");
    assert.equal(res.body.user.avatar, null);
    assert.equal(res.body.user.password, undefined);
  });

  test("session for a deleted user is logged out, not an error", async () => {
    const token = cookieFor(user);
    await User.deleteMany({});
    const res = fakeRes();
    await handleSession({ cookies: { auth_token: token } }, res);
    assert.deepEqual(res.body, { user: null });
  });

  test("GET /user keeps working avatars and drops dead ones", async () => {
    let res = fakeRes();
    await handleGetUser({ user: { id: user._id.toString() } }, res);
    assert.equal(res.body.user.avatar, null);

    await User.updateOne({ _id: user._id }, { avatar: CLOUDINARY });
    res = fakeRes();
    await handleGetUser({ user: { id: user._id.toString() } }, res);
    assert.equal(res.body.user.avatar, CLOUDINARY);
  });

  test("without Cloudinary, a new listing stores category artwork, not the browser's URL", async () => {
    await Upload.create({ formId: "form-1" });
    const res = fakeRes();
    await createAuction(
      {
        user: { id: user._id.toString() },
        body: {
          itemName: "Vintage Mechanical Watch",
          itemDescription: "Working",
          itemCategory: "Collectibles",
          startingPrice: "10000",
          itemEndDate: new Date(Date.now() + 24 * HOUR).toISOString(),
          formId: "form-1",
          public_id: "demo",
          secure_url: PICSUM,
        },
      },
      res,
    );
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const saved = await Product.findOne();
    assert.equal(saved.itemImage.url, placeholderImage("Collectibles"));
    assert.equal(saved.itemImage.public_id, "placeholder");
  });

  test("lots saved earlier with picsum URLs are served with artwork instead", async () => {
    const lot = await Product.create({
      itemName: "Old lot",
      itemDescription: "Saved before the fix",
      itemCategory: "Clothing",
      itemImage: { public_id: "demo", url: PICSUM },
      startingPrice: 100,
      currentPrice: 100,
      itemEndDate: new Date(Date.now() + HOUR),
      seller: user._id,
    });

    const view = toPublicAuction(lot);
    assert.equal(view.itemImage.url, placeholderImage("Clothing"));

    const res = fakeRes();
    await showAuction({ query: {} }, res);
    assert.equal(res.body.auctions[0].itemPhoto, placeholderImage("Clothing"));

    // The stored record is untouched
    assert.equal((await Product.findById(lot._id)).itemImage.url, PICSUM);
  });
});
