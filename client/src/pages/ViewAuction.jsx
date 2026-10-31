import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { useViewAuction, useToggleWatch } from "../hooks/useAuction.js";
import { useSocket } from "../hooks/useSocket.js";
import LoadingScreen from "../components/LoadingScreen.jsx";
import { BidPanel } from "../components/BidPanel.jsx";
import { PriceChart } from "../components/PriceChart.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { FORMATS, dutchPriceAt, formatRs } from "../utils/auction.js";
import { IoHeart, IoHeartOutline } from "react-icons/io5";

export const ViewAuction = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const currentUserId = user?.user?._id;
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const { data: fetchedData, isLoading, error } = useViewAuction(id);
  const { mutate: toggleWatch } = useToggleWatch(id);
  const { activeUsers, liveAuction, socketError, isConnected } = useSocket(
    id,
    currentUserId,
  );

  // Broadcasts are public, so the viewer's private fields come from the fetch
  const data = liveAuction ? { ...fetchedData, ...liveAuction } : fetchedData;
  useDocumentTitle(data?.itemName ? data.itemName : "Auction Details");

  // Live countdown timer — must be called before any early return to satisfy Rules of Hooks
  useEffect(() => {
    if (!data?.itemEndDate) return;
    const updateCountdown = () => {
      const diff = Math.max(0, new Date(data.itemEndDate) - new Date());
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [data?.itemEndDate]);

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 text-center">
        <p className="text-gray-500">
          {error.response?.data?.message || "This auction could not be loaded."}
        </p>
      </div>
    );
  }

  if (isLoading || !data) return <LoadingScreen />;

  const timeLeft = Math.max(0, new Date(data.itemEndDate) - new Date());
  const isActive = timeLeft > 0 && !data.settledAt;
  const isSeller = data.seller._id === currentUserId;
  const winnerData = data.winner;
  const format = FORMATS[data.format] || FORMATS.english;
  const isSealed = data.format === "sealed";
  const isDutch = data.format === "dutch";
  const sealedHidden = isSealed && !data.settledAt;
  const shownPrice = isDutch && isActive ? dutchPriceAt(data) : data.currentPrice;
  const leaderId = winnerData?._id ?? data.highBidder;
  const leaderRow = data.bids.findIndex(
    (b) => b.bidder?._id && b.bidder._id === leaderId,
  );

  const otherUsers = activeUsers.filter((u) => u.userId !== currentUserId);

  const avatarColors = [
    "bg-brand-100 text-brand-600",
    "bg-rose-100 text-rose-600",
    "bg-amber-100 text-amber-700",
    "bg-teal-100 text-teal-600",
    "bg-violet-100 text-violet-600",
    "bg-sky-100 text-sky-600",
  ];
  const getAvatarColor = (name) => {
    const hash = (name || "")
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0);
    return avatarColors[hash % avatarColors.length];
  };

  const BidHistoryList = () =>
    sealedHidden ? (
      <div className="py-10 text-center">
        <p className="text-gray-500 text-sm font-medium">
          {data.sealedBidCount} sealed bid{data.sealedBidCount !== 1 && "s"} so
          far
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Amounts and names are revealed when the auction closes.
        </p>
      </div>
    ) : data.bids.length === 0 ? (
      <div className="py-10 text-center">
        <p className="text-gray-400 text-sm">No bids yet</p>
        <p className="text-gray-300 text-xs mt-1">
          {isDutch
            ? "The first person to accept the price wins."
            : "Be the first to place a bid!"}
        </p>
      </div>
    ) : (
      <div className="space-y-2">
        {data.bids.map((bid, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-3 rounded-xl transition ${
              index === leaderRow
                ? "bg-brand-50 border border-brand-100"
                : "hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${getAvatarColor(bid.bidder?.name)}`}
              >
                {bid.bidder?.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {bid.bidder?.name}
                  {index === leaderRow && (
                    <span className="ml-2 text-[10px] font-semibold uppercase text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded">
                      {winnerData ? "Winner" : "Leading"}
                    </span>
                  )}
                  {bid.isAuto && (
                    <span className="ml-2 text-[10px] font-semibold uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      Auto
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(bid.bidTime).toLocaleString()}
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-700 tabular-nums">
              {formatRs(bid.bidAmount)}
            </span>
          </div>
        ))}
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Back Button */}
        <button
          onClick={() => {
            if (document.startViewTransition) {
              document.startViewTransition(() => navigate(-1));
            } else {
              navigate(-1);
            }
          }}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-brand-600 transition mb-6 group"
        >
          <svg
            className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left — Image + Bid History */}
          <div className="lg:col-span-7">
            <div className="sticky top-6 space-y-6">
              {/* Image */}
              <div className="relative group">
                <div className="aspect-[4/3] bg-white rounded-2xl overflow-hidden border border-gray-200/80 shadow-sm">
                  <img
                    src={data.itemImage?.url || "https://picsum.photos/601"}
                    alt={data.itemName}
                    className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                </div>
                {/* Floating status badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm ${
                      isActive
                        ? "bg-emerald-500/90 text-white"
                        : "bg-gray-800/80 text-white"
                    }`}
                  >
                    {isActive ? "Live Auction" : "Ended"}
                  </span>
                  {isConnected && isActive && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-white bg-gray-900/60 backdrop-blur-sm px-2.5 py-1.5 rounded-full">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                      </span>
                      {activeUsers.length} watching
                    </span>
                  )}
                </div>
              </div>

              {!isDutch && !sealedHidden && data.bids.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Price over time
                  </h3>
                  <PriceChart bids={data.bids} />
                </div>
              )}

              {/* Bid History — Desktop */}
              <div className="hidden lg:block bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Bid History
                </h3>
                <BidHistoryList />
              </div>
            </div>
          </div>

          {/* Right — Details */}
          <div className="lg:col-span-5 space-y-5">
            {/* Title & Category */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${format.badge}`}
                >
                  {format.label} auction
                </span>
                <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
                  {data.itemCategory}
                </span>
                <button
                  type="button"
                  onClick={() => toggleWatch()}
                  aria-pressed={!!data.isWatching}
                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-rose-600 transition"
                >
                  {data.isWatching ? (
                    <IoHeart className="w-4 h-4 text-rose-500" />
                  ) : (
                    <IoHeartOutline className="w-4 h-4" />
                  )}
                  {data.isWatching ? "Watching" : "Watch"}
                </button>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                {data.itemName}
              </h1>
              <p className="mt-3 text-gray-500 text-[15px] leading-relaxed">
                {data.itemDescription}
              </p>
              <p className="mt-3 text-xs text-gray-500 leading-relaxed bg-stone-100 rounded-xl px-3.5 py-2.5">
                <span className="font-semibold text-gray-700">
                  How this sale works:{" "}
                </span>
                {format.rules}
              </p>
            </div>

            {/* Price Card */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {data.settledAt && data.outcome === "sold"
                        ? "Final Price"
                        : isDutch
                          ? "Price Now"
                          : sealedHidden
                            ? "Opening Price"
                            : "Current Bid"}
                    </p>
                    <p className="text-3xl sm:text-4xl font-bold text-gray-900 mt-1 tabular-nums">
                      {formatRs(shownPrice)}
                    </p>
                    {!sealedHidden && (
                      <p className="text-xs text-gray-400 mt-1">
                        Started at {formatRs(data.startingPrice)}
                      </p>
                    )}
                    {data.hasReserve && !sealedHidden && (
                      <p
                        className={`text-xs font-medium mt-1.5 ${
                          data.reserveMet ? "text-emerald-600" : "text-amber-700"
                        }`}
                      >
                        {data.reserveMet
                          ? "Reserve met"
                          : "Reserve not met yet"}
                      </p>
                    )}
                    {data.hasReserve && sealedHidden && (
                      <p className="text-xs font-medium text-amber-700 mt-1.5">
                        Has a hidden reserve
                      </p>
                    )}
                    {isSeller && data.reservePrice != null && (
                      <p className="text-xs text-gray-400 mt-1">
                        Your reserve: {formatRs(data.reservePrice)}
                      </p>
                    )}
                    {data.extensions > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Extended {data.extensions} time
                        {data.extensions !== 1 && "s"} by late bids
                      </p>
                    )}
                  </div>
                  <div className={`text-right ${isDutch ? "hidden" : ""}`}>
                    <div className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {sealedHidden ? data.sealedBidCount : data.bids.length} bid
                      {(sealedHidden ? data.sealedBidCount : data.bids.length) !==
                        1 && "s"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Left Bar */}
              {isActive ? (
                <div className="bg-red-50 border-t border-red-100 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-4 h-4 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm text-red-600 font-medium">
                        Time remaining
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {countdown.days > 0 && (
                        <span className="bg-red-100 text-red-700 text-sm font-bold px-2 py-0.5 rounded-md tabular-nums">
                          {countdown.days}d
                        </span>
                      )}
                      <span className="bg-red-100 text-red-700 text-sm font-bold px-2 py-0.5 rounded-md tabular-nums">
                        {String(countdown.hours).padStart(2, "0")}h
                      </span>
                      <span className="bg-red-100 text-red-700 text-sm font-bold px-2 py-0.5 rounded-md tabular-nums">
                        {String(countdown.minutes).padStart(2, "0")}m
                      </span>
                      <span className="bg-red-100 text-red-700 text-sm font-bold px-2 py-0.5 rounded-md tabular-nums">
                        {String(countdown.seconds).padStart(2, "0")}s
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 border-t border-gray-200 px-6 py-4 text-center">
                  <p className="text-sm font-medium text-gray-500">
                    Auction ended
                  </p>
                </div>
              )}
            </div>

            {/* Winner Section */}
            {!isActive && winnerData && (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-amber-100 p-2 rounded-xl">
                    <svg
                      className="w-5 h-5 text-amber-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 3l3.057-3L12 3.943 15.943 0 19 3l-7 7-7-7z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 10v4m0 0l-3 6h6l-3-6z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                      Winner
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {winnerData.name}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-amber-700">
                  {isSealed ? "Pays the second-highest price of " : "Won for "}
                  <span className="font-bold">
                    {formatRs(data.currentPrice)}
                  </span>
                </p>
                {winnerData._id === currentUserId && (
                  <div className="mt-3 bg-amber-100 text-amber-800 text-sm font-medium px-4 py-2 rounded-xl">
                    🎉 Congratulations! You won this auction!
                  </div>
                )}
              </div>
            )}

            {data.outcome === "no_bids" && (
              <div className="bg-gray-100 rounded-2xl border border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-500">
                  This auction ended with no bids.
                </p>
              </div>
            )}

            {data.outcome === "reserve_not_met" && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 text-center">
                <p className="text-sm text-amber-800">
                  Bidding closed below the seller&apos;s reserve, so this item
                  did not sell.
                </p>
              </div>
            )}

            {/* Bid Panel */}
            {!isSeller && isActive && (
              <BidPanel auction={data} currentUserId={currentUserId} />
            )}

            {/* Socket Error */}
            {socketError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                {socketError}
              </div>
            )}

            {/* Active Users */}
            {otherUsers.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Also watching
                </h3>
                <div className="flex flex-wrap gap-2">
                  {otherUsers.map((u) => (
                    <div
                      key={u.userId}
                      className="flex items-center gap-2 bg-gray-50 pl-1.5 pr-3 py-1 rounded-full"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(u.userName)}`}
                      >
                        {u.userName?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-gray-600">
                        {u.userName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seller */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Seller
              </h3>
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getAvatarColor(data.seller.name)}`}
                >
                  {data.seller.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {data.seller.name}
                  </p>
                  <p className="text-xs text-gray-400">Auction creator</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bid History — Mobile */}
        <div className="mt-8 lg:hidden bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Bid History
          </h3>
          <BidHistoryList />
        </div>
      </div>
    </div>
  );
};
