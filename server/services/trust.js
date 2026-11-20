// Pure rules for post-settlement reviews and the verified seller badge

export const COMMENT_MAX = 500;
export const VERIFIED_MIN_SALES = 3;
export const VERIFIED_MIN_RATINGS = 3;
export const VERIFIED_MIN_AVERAGE = 4;

const idOf = (ref) => (ref?._id ?? ref)?.toString() ?? null;

// Which side of a sold lot this user may review from, or why they cannot
export const reviewRoleFor = (auction, userId) => {
  if (!auction.settledAt) {
    return { error: "You can leave a review once the auction settles" };
  }
  if (auction.outcome !== "sold" || !auction.winner) {
    return { error: "Only auctions that ended in a sale can be reviewed" };
  }
  if (idOf(auction.winner) === userId) {
    return { role: "buyer", revieweeId: idOf(auction.seller) };
  }
  if (idOf(auction.seller) === userId) {
    return { role: "seller", revieweeId: idOf(auction.winner) };
  }
  return { error: "Only the winning bidder and the seller can review this sale" };
};

// Cleans and checks a submitted review
export const validateReview = ({ rating, comment }) => {
  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { error: "Rating must be a whole number from 1 to 5" };
  }
  if (comment != null && typeof comment !== "string") {
    return { error: "Review must be text" };
  }
  const text = (comment ?? "").trim();
  if (text.length > COMMENT_MAX) {
    return { error: `Review must be ${COMMENT_MAX} characters or fewer` };
  }
  return { rating: stars, comment: text };
};

// Rating summary and badge for a seller, from counts the database totals up
export const sellerTrust = ({ ratingCount = 0, ratingSum = 0, completedSales = 0 }) => {
  const averageRating =
    ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null;
  return {
    averageRating,
    ratingCount,
    completedSales,
    verified:
      completedSales >= VERIFIED_MIN_SALES &&
      ratingCount >= VERIFIED_MIN_RATINGS &&
      ratingSum / ratingCount >= VERIFIED_MIN_AVERAGE,
  };
};
