import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import {
  GEO_TIMEOUT_MS,
  getClientIp,
  getLocationFromIp,
  isPublicIp,
} from "../utils/geoDetails.js";

const UNKNOWN = { country: "Unknown", region: "Unknown", city: "Unknown", isp: "Unknown" };

describe("isPublicIp", () => {
  test("accepts public IPv4 and IPv6 addresses", () => {
    for (const ip of ["8.8.8.8", "203.0.113.5", "::ffff:8.8.8.8", "2001:4860:4860::8888"]) {
      assert.equal(isPublicIp(ip), true, ip);
    }
  });

  test("rejects loopback, private, link-local and carrier-grade NAT", () => {
    for (const ip of [
      "127.0.0.1", "::1", "::ffff:127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255",
      "192.168.1.10", "169.254.1.1", "100.64.0.1", "0.0.0.0", "::", "fc00::1", "fd12:3456::1", "fe80::1",
    ]) {
      assert.equal(isPublicIp(ip), false, ip);
    }
  });

  test("172.15 and 172.32 are public, just outside the private range", () => {
    assert.equal(isPublicIp("172.15.0.1"), true);
    assert.equal(isPublicIp("172.32.0.1"), true);
  });

  test("rejects anything that is not an IP address", () => {
    for (const value of ["", "localhost", "../../batch", "8.8.8.8/../x", "1.2.3", null, undefined, 42, {}]) {
      assert.equal(isPublicIp(value), false, String(value));
    }
  });
});

describe("getLocationFromIp", () => {
  const realGet = axios.get;
  let calls;
  let reply;

  beforeEach(() => {
    calls = [];
    reply = async () => ({ data: { status: "success", country: "India", regionName: "Delhi", city: "New Delhi", isp: "ISP" } });
    axios.get = async (url, options) => {
      calls.push({ url, options });
      return reply(url, options);
    };
  });

  afterEach(() => {
    axios.get = realGet;
  });

  test("looks up a public address with a timeout", async () => {
    const location = await getLocationFromIp("8.8.8.8");
    assert.deepEqual(location, { country: "India", region: "Delhi", city: "New Delhi", isp: "ISP" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://ip-api.com/json/8.8.8.8");
    assert.equal(calls[0].options.timeout, GEO_TIMEOUT_MS);
    assert.ok(GEO_TIMEOUT_MS > 0 && GEO_TIMEOUT_MS <= 5000);
  });

  test("an IPv4-mapped address is looked up as plain IPv4", async () => {
    await getLocationFromIp("::ffff:8.8.8.8");
    assert.equal(calls[0].url, "http://ip-api.com/json/8.8.8.8");
  });

  test("local, private and malformed addresses never reach the network", async () => {
    for (const ip of ["::1", "127.0.0.1", "192.168.0.5", "../../batch", "", undefined]) {
      assert.deepEqual(await getLocationFromIp(ip), UNKNOWN, String(ip));
    }
    assert.equal(calls.length, 0);
  });

  test("a timeout or network error falls back to Unknown", async () => {
    reply = async () => {
      const error = new Error("timeout of 2000ms exceeded");
      error.code = "ECONNABORTED";
      throw error;
    };
    assert.deepEqual(await getLocationFromIp("8.8.8.8"), UNKNOWN);
  });

  test("a failed or empty answer falls back to Unknown", async () => {
    reply = async () => ({ data: { status: "fail", message: "reserved range" } });
    assert.deepEqual(await getLocationFromIp("8.8.8.8"), UNKNOWN);
    reply = async () => ({});
    assert.deepEqual(await getLocationFromIp("8.8.8.8"), UNKNOWN);
  });

  test("each fallback is a fresh object, so callers cannot change a shared one", async () => {
    const a = await getLocationFromIp("::1");
    a.country = "Changed";
    assert.equal((await getLocationFromIp("::1")).country, "Unknown");
  });
});

describe("getClientIp", () => {
  const req = (forwarded, remote = "10.0.0.2") => ({
    headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded },
    socket: { remoteAddress: remote },
  });

  test("uses the first X-Forwarded-For address", () => {
    assert.equal(getClientIp(req("203.0.113.5, 10.0.0.1")), "203.0.113.5");
    assert.equal(getClientIp(req("2001:db8::1")), "2001:db8::1");
  });

  test("ignores a header value that is not an IP address", () => {
    assert.equal(getClientIp(req("../../batch, 203.0.113.5")), "10.0.0.2");
    assert.equal(getClientIp(req("not-an-ip")), "10.0.0.2");
  });

  test("falls back to the socket address, then req.ip", () => {
    assert.equal(getClientIp(req(undefined)), "10.0.0.2");
    assert.equal(getClientIp({ headers: {}, ip: "203.0.113.9" }), "203.0.113.9");
  });
});
