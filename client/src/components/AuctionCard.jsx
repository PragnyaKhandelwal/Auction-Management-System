import { Link } from "react-router";
import { usePrefetchHandlers } from "../hooks/useAuction.js";
import { FORMATS, formatRs, formatTimeLeft } from "../utils/auction.js";

const priceLabels = {
  english: "Current Bid",
  dutch: "Price Now",
  sealed: "Opens At",
};

export default function AuctionCard({ auction }) {
  const isActive = auction.timeLeft > 0;
  const isUpcoming = auction.startsIn > 0;
  const { prefetchAuction } = usePrefetchHandlers();
  const format = FORMATS[auction.format] || FORMATS.english;

  return (
    <Link
      to={`/auction/${auction._id}`}
      viewTransition
      onMouseEnter={() => prefetchAuction(auction._id)}
      className="group block w-full bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-gray-300/80 transition-all duration-200"
    >
      {/* Image */}
      <div className="relative aspect-[3/2] overflow-hidden rounded-t-2xl bg-gray-100">
        <img
          src={auction.itemPhoto || "https://picsum.photos/300"}
          alt={auction.itemName}
          className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm ${format.badge}`}
          >
            {format.label}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full shadow-sm ${
              isActive
                ? "bg-white/90 text-gray-800 backdrop-blur-sm"
                : "bg-gray-700/80 text-white"
            }`}
          >
            {isUpcoming && isActive
              ? "Upcoming"
              : formatTimeLeft(auction.timeLeft)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5">
        <h3 className="font-semibold text-sm text-gray-900 mb-0.5 line-clamp-1 group-hover:text-brand-600 transition-colors">
          {auction.itemName}
        </h3>
        <p className="text-gray-400 text-[11px] mb-3 line-clamp-1 leading-relaxed">
          {auction.itemDescription}
        </p>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              {priceLabels[auction.format] || priceLabels.english}
            </p>
            <p className="text-lg font-bold text-gray-900 tabular-nums">
              {formatRs(auction.currentPrice)}
            </p>
          </div>
          <span className="text-[11px] text-gray-400">
            {auction.format === "dutch"
              ? "First to accept"
              : auction.format === "sealed"
                ? `${auction.bidsCount} sealed`
                : `${auction.bidsCount} bids`}
          </span>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-400 truncate">
            {auction.itemCategory} &middot; by{" "}
            {auction?.sellerName || auction?.seller?.name}
          </p>
          <span className="text-[11px] font-medium text-brand-500 group-hover:text-brand-600 transition-colors shrink-0">
            View &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}
