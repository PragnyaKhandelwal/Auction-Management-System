/* eslint-disable react/prop-types */
import { useState } from "react";
import { StarInput, StarRating } from "./StarRating.jsx";
import { useReviewAuction } from "../hooks/useAuction.js";

const COMMENT_MAX = 500;

const ReviewQuote = ({ title, review }) => (
  <div className="bg-gray-50 rounded-xl p-3">
    <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
    <StarRating value={review.rating} />
    {review.comment && (
      <p className="text-sm text-gray-700 mt-1.5 break-words">{review.comment}</p>
    )}
  </div>
);

// Lets the winner rate the seller, or the seller rate the winner, after a sale
export const ReviewPanel = ({ auctionId, review, otherName }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const { mutate, isPending, error } = useReviewAuction(auctionId);

  const target = review.role === "buyer" ? "the seller" : "the buyer";
  const submit = (e) => {
    e.preventDefault();
    if (rating) mutate({ rating, comment });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700">
        {review.myReview ? "Your review" : `Rate ${otherName || target}`}
      </h3>

      {review.myReview ? (
        <div className="mt-3">
          <ReviewQuote title="You rated" review={review.myReview} />
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <p className="text-xs text-gray-500">
            How did this sale go? Your rating helps other people on Boli decide
            who to trade with. You can&apos;t change it after posting.
          </p>
          <StarInput value={rating} onChange={setRating} disabled={isPending} />
          <div>
            <label htmlFor="review-comment" className="sr-only">
              Review (optional)
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
              placeholder="Add a few words (optional)"
              rows={3}
              disabled={isPending}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
            <p className="text-[11px] text-gray-400 text-right">
              {comment.length}/{COMMENT_MAX}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error.response?.data?.message || "Could not save your review."}
            </p>
          )}
          <button
            type="submit"
            disabled={!rating || isPending}
            className="w-full py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Posting..." : "Post review"}
          </button>
        </form>
      )}

      {review.theirReview && (
        <div className="mt-3">
          <ReviewQuote
            title={`${otherName || "They"} rated you`}
            review={review.theirReview}
          />
        </div>
      )}
    </div>
  );
};
