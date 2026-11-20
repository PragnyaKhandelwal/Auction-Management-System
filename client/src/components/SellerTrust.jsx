/* eslint-disable react/prop-types */
import { MdVerified } from "react-icons/md";
import { StarRating } from "./StarRating.jsx";

export const VerifiedBadge = () => (
  <span
    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-1.5 py-0.5 rounded-full"
    title="3 or more completed sales with an average buyer rating of 4 stars or higher"
  >
    <MdVerified className="w-3.5 h-3.5" aria-hidden="true" />
    Verified seller
  </span>
);

// Buyer rating average and completed sales for the seller card
export const SellerTrust = ({ trust }) => {
  if (!trust) return null;
  const sales = `${trust.completedSales} completed sale${trust.completedSales === 1 ? "" : "s"}`;
  return (
    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {trust.ratingCount > 0 ? (
        <>
          <StarRating value={trust.averageRating} />
          <span className="font-semibold text-gray-700">
            {trust.averageRating.toFixed(1)}
          </span>
          <span>
            ({trust.ratingCount} rating{trust.ratingCount === 1 ? "" : "s"})
          </span>
        </>
      ) : (
        <span>No ratings yet</span>
      )}
      <span aria-hidden="true">·</span>
      <span>{sales}</span>
    </div>
  );
};
