import { useState } from "react";
import { IoStar, IoStarOutline, IoStarHalf } from "react-icons/io5";

const sizes = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-7 h-7" };

// Read-only stars, rounded to the nearest half
export const StarRating = ({ value, size = "sm" }) => {
  const halves = Math.round(value * 2);
  return (
    <span
      className="inline-flex items-center gap-0.5 text-amber-500"
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const Icon =
          halves >= star * 2 ? IoStar : halves === star * 2 - 1 ? IoStarHalf : IoStarOutline;
        return <Icon key={star} className={sizes[size]} aria-hidden="true" />;
      })}
    </span>
  );
};

const LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

// Star picker that works as a radio group for keyboards and screen readers
export const StarInput = ({ value, onChange, disabled }) => {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Rating"
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}, ${LABELS[star - 1]}`}
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            className="text-amber-500 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60"
          >
            {star <= shown ? (
              <IoStar className={sizes.lg} aria-hidden="true" />
            ) : (
              <IoStarOutline className={sizes.lg} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      {shown > 0 && (
        <span className="text-sm font-medium text-gray-600">{LABELS[shown - 1]}</span>
      )}
    </div>
  );
};
