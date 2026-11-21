import axios from "axios";
import net from "node:net";

// Login and signup wait for this lookup, so it must never hold them up for long
export const GEO_TIMEOUT_MS = 2000;

const unknownLocation = () => ({
  country: "Unknown",
  region: "Unknown",
  city: "Unknown",
  isp: "Unknown",
});

// "::ffff:203.0.113.5" is an IPv4 address written as IPv6
const unwrapMappedIpv4 = (ip) => ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");

const isPrivateIpv4 = (ip) => {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
};

const isPrivateIpv6 = (ip) => {
  const lower = ip.toLowerCase();
  return (
    lower === "::" ||
    lower === "::1" ||
    /^f[cd][0-9a-f]{2}:/.test(lower) || // unique local fc00::/7
    /^fe[89ab][0-9a-f]:/.test(lower) // link-local fe80::/10
  );
};

// True only for a well-formed IP address on the public internet: the only kind
// a location service can tell anything about
export const isPublicIp = (value) => {
  if (typeof value !== "string") return false;
  const ip = unwrapMappedIpv4(value.trim());
  const version = net.isIP(ip);
  if (version === 4) return !isPrivateIpv4(ip);
  if (version === 6) return !isPrivateIpv6(ip);
  return false;
};

export const getLocationFromIp = async (ip) => {
  // Local, private or malformed addresses: nothing to look up
  if (!isPublicIp(ip)) return unknownLocation();

  try {
    // Note: ip-api.com free tier only supports HTTP.
    // Consider switching to ipapi.co or ipinfo.io for HTTPS support.
    const address = encodeURIComponent(unwrapMappedIpv4(ip.trim()));
    const response = await axios.get(`http://ip-api.com/json/${address}`, {
      timeout: GEO_TIMEOUT_MS,
    });
    if (response.data?.status === "success") {
      return {
        country: response.data.country,
        region: response.data.regionName,
        city: response.data.city,
        isp: response.data.isp,
      };
    }
    return unknownLocation();
  } catch (error) {
    console.log("Geo API error:", error.message);
    return unknownLocation();
  }
};

export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  // x-forwarded-for may contain multiple IPs: "client, proxy1, proxy2"
  const first = forwarded ? String(forwarded).split(",")[0].trim() : null;
  // Ignore anything in the header that is not an IP address
  const ip = first && net.isIP(unwrapMappedIpv4(first)) ? first : null;
  return ip || req.socket?.remoteAddress || req.ip;
};
