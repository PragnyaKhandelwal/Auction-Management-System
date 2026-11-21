import "./setup.js";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import axios from "axios";
import { MongoMemoryServer } from "mongodb-memory-server";
import { env } from "../config/env.config.js";
import User from "../models/user.model.js";
import Login from "../models/login.model.js";
import {
  handleGoogleConfig,
  handleGoogleLogin,
  handleSession,
  handleUserLogin,
} from "../controllers/auth.controller.js";
import { handleChangePassword, handleGetUser } from "../controllers/user.controller.js";
import { setGoogleVerifierForTests } from "../services/googleAuth.service.js";
import jwt from "jsonwebtoken";

const CLIENT_ID = "test-client.apps.googleusercontent.com";

// The login flow looks up the visitor's location over HTTP; never call out in tests
axios.get = async () => ({ data: { status: "fail" } });

const fakeRes = () => {
  const res = { statusCode: 200, cookies: {} };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  res.cookie = (name, value) => ((res.cookies[name] = value), res);
  return res;
};

const fakeReq = (body = {}, extra = {}) => ({
  body,
  headers: { "user-agent": "test", "x-forwarded-for": "203.0.113.5" },
  socket: {},
  ...extra,
});

const profile = (overrides = {}) => ({
  googleId: "google-sub-123",
  email: "meera@example.com",
  emailVerified: true,
  name: "Meera",
  picture: "https://lh3.googleusercontent.com/a/photo",
  ...overrides,
});

// Fake Google: a credential is just the JSON of the profile it stands for
const fakeVerifier = async (credential) => {
  if (credential === "bad-token") throw new Error("Invalid token signature");
  return JSON.parse(credential);
};
const credentialFor = (p) => JSON.stringify(p);

const googleLogin = async (p) => {
  const res = fakeRes();
  await handleGoogleLogin(fakeReq({ credential: credentialFor(p) }), res);
  return res;
};

describe("Google sign-in", () => {
  let mongo;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await User.init();
  });

  after(async () => {
    setGoogleVerifierForTests(null);
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    env.google_client_id = CLIENT_ID;
    setGoogleVerifierForTests(fakeVerifier);
    await Promise.all([User.deleteMany({}), Login.deleteMany({})]);
  });

  afterEach(() => {
    env.google_client_id = undefined;
  });

  test("config hides Google when no client ID is set", () => {
    env.google_client_id = undefined;
    const res = fakeRes();
    handleGoogleConfig({}, res);
    assert.deepEqual(res.body, { enabled: false, clientId: null });
  });

  test("config shares the public client ID when set", () => {
    const res = fakeRes();
    handleGoogleConfig({}, res);
    assert.deepEqual(res.body, { enabled: true, clientId: CLIENT_ID });
  });

  test("sign-in is refused when Google is not configured", async () => {
    env.google_client_id = undefined;
    const res = await googleLogin(profile());
    assert.equal(res.statusCode, 404);
    assert.equal(await User.countDocuments(), 0);
  });

  test("a missing or invalid credential is refused", async () => {
    let res = fakeRes();
    await handleGoogleLogin(fakeReq({}), res);
    assert.equal(res.statusCode, 400);

    res = fakeRes();
    await handleGoogleLogin(fakeReq({ credential: { $ne: "" } }), res);
    assert.equal(res.statusCode, 400);

    res = fakeRes();
    await handleGoogleLogin(fakeReq({ credential: "bad-token" }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.cookies.auth_token, undefined);
  });

  test("a new Google user gets an account with no password and a session", async () => {
    const res = await googleLogin(profile());
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.created, true);

    const user = await User.findOne({ email: "meera@example.com" });
    assert.equal(user.googleId, "google-sub-123");
    assert.equal(user.password, undefined);
    assert.equal(user.name, "Meera");
    assert.equal(user.role, "user");
    assert.equal(user.avatar, "https://lh3.googleusercontent.com/a/photo");

    const token = jwt.verify(res.cookies.auth_token, process.env.JWT_SECRET);
    assert.equal(token.id, user._id.toString());
    assert.equal(await Login.countDocuments({ userId: user._id }), 1);
  });

  test("signing in again finds the same account", async () => {
    await googleLogin(profile());
    const res = await googleLogin(profile({ email: "changed@example.com" }));
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.created, false);
    assert.equal(await User.countDocuments(), 1);
  });

  test("an existing email account is linked, keeping its password and role", async () => {
    const existing = await User.create({
      name: "Meera K",
      email: "Meera@Example.com",
      password: await bcrypt.hash("password123", 10),
      role: "admin",
      avatar: "https://res.cloudinary.com/demo/me.jpg",
    });

    const res = await googleLogin(profile());
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.linked, true);
    assert.equal(await User.countDocuments(), 1);

    const user = await User.findById(existing._id);
    assert.equal(user.googleId, "google-sub-123");
    assert.ok(await bcrypt.compare("password123", user.password));
    assert.equal(user.role, "admin");
    assert.equal(user.name, "Meera K");
    assert.equal(user.avatar, "https://res.cloudinary.com/demo/me.jpg");

    const token = jwt.verify(res.cookies.auth_token, process.env.JWT_SECRET);
    assert.equal(token.role, "admin");
  });

  test("an unverified Google email never creates or links an account", async () => {
    await User.create({
      name: "Owner",
      email: "meera@example.com",
      password: await bcrypt.hash("password123", 10),
    });
    const res = await googleLogin(profile({ emailVerified: false }));
    assert.equal(res.statusCode, 401);
    assert.equal(res.cookies.auth_token, undefined);
    assert.equal((await User.findOne()).googleId, undefined);

    await User.deleteMany({});
    const fresh = await googleLogin(profile({ emailVerified: false }));
    assert.equal(fresh.statusCode, 401);
    assert.equal(await User.countDocuments(), 0);
  });

  test("an email already linked to another Google account is refused", async () => {
    await googleLogin(profile({ googleId: "first-google-account" }));
    const res = await googleLogin(profile({ googleId: "second-google-account" }));
    assert.equal(res.statusCode, 409);
    assert.equal(res.cookies.auth_token, undefined);
    assert.equal((await User.findOne()).googleId, "first-google-account");
  });

  test("simultaneous first sign-ins create one account", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => googleLogin(profile())),
    );
    assert.ok(
      results.every((r) => r.statusCode === 200 || r.statusCode === 201),
      JSON.stringify(results.map((r) => [r.statusCode, r.body])),
    );
    assert.equal(await User.countDocuments(), 1);
  });

  test("password login on a Google-only account fails cleanly, not with a 500", async () => {
    await googleLogin(profile());
    const res = fakeRes();
    await handleUserLogin(
      fakeReq({ email: "meera@example.com", password: "anything123" }),
      res,
    );
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Invalid email or password");
  });

  test("the user profile says whether a password exists, never the hash", async () => {
    await googleLogin(profile());
    const user = await User.findOne();
    const res = fakeRes();
    await handleGetUser({ user: { id: user._id.toString() } }, res);
    assert.equal(res.body.user.hasPassword, false);
    assert.equal(res.body.user.googleLinked, true);
    assert.equal(res.body.user.password, undefined);
    assert.equal(res.body.user.googleId, undefined);

    const session = fakeRes();
    const cookie = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET);
    await handleSession({ cookies: { auth_token: cookie } }, session);
    assert.equal(session.body.user.hasPassword, false);
    assert.equal(session.body.user.password, undefined);
  });

  test("a Google-only user can set a first password, then log in with it", async () => {
    await googleLogin(profile());
    const user = await User.findOne();
    const set = fakeRes();
    await handleChangePassword(
      {
        user: { id: user._id.toString() },
        body: { newPassword: "newpass123", confirmPassword: "newpass123" },
      },
      set,
    );
    assert.equal(set.statusCode, 200, JSON.stringify(set.body));
    assert.match(set.body.message, /Password set/);

    const login = fakeRes();
    await handleUserLogin(
      fakeReq({ email: "meera@example.com", password: "newpass123" }),
      login,
    );
    assert.equal(login.statusCode, 200);

    // From now on the current password is required to change it
    const change = fakeRes();
    await handleChangePassword(
      {
        user: { id: user._id.toString() },
        body: { newPassword: "another123", confirmPassword: "another123" },
      },
      change,
    );
    assert.equal(change.statusCode, 400);
  });

  test("password accounts still need their current password to change it", async () => {
    const user = await User.create({
      name: "Asha",
      email: "asha@example.com",
      password: await bcrypt.hash("password123", 10),
    });
    const send = async (body) => {
      const res = fakeRes();
      await handleChangePassword({ user: { id: user._id.toString() }, body }, res);
      return res;
    };
    assert.equal(
      (await send({ newPassword: "newpass123", confirmPassword: "newpass123" })).statusCode,
      400,
    );
    assert.equal(
      (await send({ currentPassword: "wrongpass1", newPassword: "newpass123", confirmPassword: "newpass123" })).statusCode,
      401,
    );
    assert.equal(
      (await send({ currentPassword: "password123", newPassword: "newpass123", confirmPassword: "newpass123" })).statusCode,
      200,
    );
  });

  test("email accounts still require a password in the database", async () => {
    await assert.rejects(
      User.create({ name: "No password", email: "np@example.com" }),
      /password/,
    );
  });
});
