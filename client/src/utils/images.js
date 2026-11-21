// Neutral artwork shown when a listing has no image or its image fails to load.
// It is a data URL, so showing it never makes a network request.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5e7eb"/><stop offset="1" stop-color="#9ca3af"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/><text x="300" y="255" font-size="170" text-anchor="middle">📦</text></svg>`;

export const PLACEHOLDER_IMAGE = `data:image/svg+xml,${encodeURIComponent(svg)}`;

// onError handler for listing images: swap to the placeholder once
export const showPlaceholderOnError = (event) => {
  const img = event.currentTarget;
  if (img.src !== PLACEHOLDER_IMAGE) img.src = PLACEHOLDER_IMAGE;
};
