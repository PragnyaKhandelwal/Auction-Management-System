// Images the app can always show, without depending on third-party hosts.
// Listings saved without Cloudinary, and accounts created before this change,
// point at free services that now fail (502s and certificate errors), so those
// URLs are swapped for self-contained artwork when they are sent to the browser.

const RETIRED_HOSTS = new Set([
  "avatar.iran.liara.run",
  "picsum.photos",
  "fastly.picsum.photos",
]);

// Emoji and gradient for each listing category
const CATEGORY_ART = {
  Electronics: ["💻", "#bae6fd", "#0369a1"],
  Antiques: ["🏺", "#fed7aa", "#c2410c"],
  Art: ["🖼️", "#e7e5e4", "#78716c"],
  Books: ["📚", "#ddd6fe", "#6d28d9"],
  Clothing: ["👗", "#fecdd3", "#be123c"],
  Collectibles: ["🪙", "#fde68a", "#b45309"],
  "Home & Garden": ["🪴", "#bbf7d0", "#15803d"],
  Jewelry: ["💍", "#fbcfe8", "#a21caf"],
  "Musical Instruments": ["🎻", "#bbf7d0", "#047857"],
  Sports: ["🏏", "#a5f3fc", "#0e7490"],
  Toys: ["🧸", "#fef08a", "#ca8a04"],
  Vehicles: ["🏍️", "#bfdbfe", "#1d4ed8"],
  Other: ["📦", "#e5e7eb", "#4b5563"],
};

export const isRetiredImageUrl = (url) => {
  if (typeof url !== "string" || !url) return false;
  try {
    return RETIRED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
};

// Category artwork as an SVG data URL, so it loads with no network request
export const placeholderImage = (category) => {
  const [emoji, from, to] = CATEGORY_ART[category] ?? CATEGORY_ART.Other;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/><text x="300" y="255" font-size="170" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// The image URL to show for a listing
export const listingImageUrl = ({ itemImage, itemCategory } = {}) => {
  const url = itemImage?.url;
  return url && !isRetiredImageUrl(url) ? url : placeholderImage(itemCategory);
};

// A user's avatar, or null so the app shows their initial instead
export const avatarUrl = (url) => (url && !isRetiredImageUrl(url) ? url : null);
