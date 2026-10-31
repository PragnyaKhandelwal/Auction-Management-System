import { useState } from "react";
import toast from "react-hot-toast";
import { useBuyAuction, usePlaceBid } from "../hooks/useAuction.js";
import {
  dutchPriceAt,
  formatRs,
  formatTimeLeft,
  msToNextDutchDrop,
} from "../utils/auction.js";

const inputClasses =
  "w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-semibold text-lg tabular-nums placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition";

const primaryButton = (busy) =>
  `px-5 py-3 rounded-xl font-semibold text-sm transition-all ${
    busy
      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
      : "bg-brand-600 text-white hover:bg-brand-700 active:scale-[0.97] shadow-sm shadow-brand-200"
  }`;

const RupeeInput = ({ id, value, onChange, placeholder, min, required }) => (
  <div className="relative flex-1">
    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
      Rs
    </span>
    <input
      type="number"
      id={id}
      name={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      step="1"
      className={inputClasses}
      placeholder={placeholder}
      required={required}
    />
  </div>
);

const errorMessage = (err, fallback) =>
  err.response?.data?.message || fallback;

const useBidSubmit = (id) => {
  const { mutateAsync, isPending } = usePlaceBid();

  const submit = async (bidAmount, maxBid) => {
    try {
      const res = await mutateAsync({ bidAmount, maxBid, id });
      if (res.outbidImmediately) toast(res.message, { icon: "⚡" });
      else toast.success(res.message);
      return true;
    } catch (err) {
      toast.error(errorMessage(err, "Failed to place bid"));
      return false;
    }
  };

  return { submit, isPending };
};

// Two-step button: buying is instant and final, so it needs a deliberate second click
const ConfirmBuy = ({ id, label, confirmLabel, className }) => {
  const [armed, setArmed] = useState(false);
  const { mutateAsync, isPending } = useBuyAuction(id);

  const handleClick = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    try {
      const res = await mutateAsync();
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err, "Could not complete this"));
    }
    setArmed(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`${className} ${armed ? "ring-2 ring-offset-2 ring-amber-500" : ""}`}
    >
      {isPending ? "Working..." : armed ? confirmLabel : label}
    </button>
  );
};

const EnglishPanel = ({ auction, currentUserId }) => {
  const [amount, setAmount] = useState("");
  const [limit, setLimit] = useState("");
  const [useLimit, setUseLimit] = useState(false);
  const { submit, isPending } = useBidSubmit(auction._id);

  const isLeader =
    auction.highBidder?.toString() === currentUserId && auction.bids.length > 0;
  const canBuyNow =
    auction.buyNowPrice && auction.currentPrice < auction.buyNowPrice;

  const handleBid = async (e) => {
    e.preventDefault();
    const ok = await submit(Number(amount), useLimit && limit ? Number(limit) : null);
    if (ok) {
      setAmount("");
      setLimit("");
    }
  };

  const handleRaise = async (e) => {
    e.preventDefault();
    if (await submit(auction.currentPrice, Number(limit))) setLimit("");
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
      {isLeader ? (
        <form onSubmit={handleRaise} className="space-y-3">
          <div className="bg-emerald-50 text-emerald-800 text-sm font-medium px-4 py-2.5 rounded-xl">
            You are the highest bidder
            {auction.myMaxBid > auction.currentPrice &&
              `, auto-bidding up to ${formatRs(auction.myMaxBid)}`}
          </div>
          <label htmlFor="raiseLimit" className="block text-sm font-semibold text-gray-700">
            Raise your auto-bid limit
          </label>
          <div className="flex gap-2">
            <RupeeInput
              id="raiseLimit"
              value={limit}
              onChange={setLimit}
              placeholder={String(auction.currentPrice + auction.bidStep)}
              min={auction.currentPrice + 1}
              required
            />
            <button type="submit" disabled={isPending} className={primaryButton(isPending)}>
              Save
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleBid} className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="bidAmount" className="text-sm font-semibold text-gray-700">
              Place your bid
            </label>
            <span className="text-xs text-gray-400">
              Minimum {formatRs(auction.minNextBid)}
            </span>
          </div>
          <div className="flex gap-2">
            <RupeeInput
              id="bidAmount"
              value={amount}
              onChange={setAmount}
              placeholder={String(auction.minNextBid)}
              min={auction.minNextBid}
              required
            />
            <button type="submit" disabled={isPending} className={primaryButton(isPending)}>
              {isPending ? "Bidding..." : "Bid Now"}
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={useLimit}
              onChange={(e) => setUseLimit(e.target.checked)}
              className="accent-brand-600"
            />
            Auto-bid for me up to a limit
          </label>
          {useLimit && (
            <div>
              <RupeeInput
                id="maxBid"
                value={limit}
                onChange={setLimit}
                placeholder="Your private limit"
                min={amount || auction.minNextBid}
                required
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Nobody sees this. Boli only bids as much as it takes to keep you
                ahead.
              </p>
            </div>
          )}
        </form>
      )}

      {canBuyNow && (
        <div className="pt-4 border-t border-gray-100">
          <ConfirmBuy
            id={auction._id}
            label={`Buy now for ${formatRs(auction.buyNowPrice)}`}
            confirmLabel={`Click again to buy for ${formatRs(auction.buyNowPrice)}`}
            className="w-full px-5 py-3 rounded-xl font-semibold text-sm bg-amber-400 text-gray-900 hover:bg-amber-500 transition"
          />
        </div>
      )}
    </div>
  );
};

const DutchPanel = ({ auction }) => {
  // Parent re-renders every second, so these stay live
  const price = dutchPriceAt(auction);
  const atFloor = price <= auction.dutchFloor;
  const secondsToDrop = Math.ceil(msToNextDutchDrop(auction) / 1000);
  const range = auction.startingPrice - auction.dutchFloor;
  const fallen = ((auction.startingPrice - price) / range) * 100;

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
      <div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${fallen}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1.5 tabular-nums">
          <span>Opened {formatRs(auction.startingPrice)}</span>
          <span>Floor {formatRs(auction.dutchFloor)}</span>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        {atFloor ? (
          "The price has reached its floor and will not fall further."
        ) : (
          <>
            Drops by {formatRs(auction.dutchDropAmount)} in{" "}
            <span className="font-semibold tabular-nums">{secondsToDrop}s</span>
          </>
        )}
      </p>
      <ConfirmBuy
        id={auction._id}
        label={`Accept ${formatRs(price)}`}
        confirmLabel={`Click again to win at ${formatRs(price)}`}
        className="w-full px-5 py-3.5 rounded-xl font-semibold bg-brand-600 text-white hover:bg-brand-700 transition tabular-nums"
      />
    </div>
  );
};

const SealedPanel = ({ auction }) => {
  const [amount, setAmount] = useState("");
  const { submit, isPending } = useBidSubmit(auction._id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (await submit(Number(amount), null)) setAmount("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-3"
    >
      {auction.mySealedBid != null && (
        <div className="bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl">
          Your sealed bid:{" "}
          <span className="font-semibold tabular-nums">
            {formatRs(auction.mySealedBid)}
          </span>
        </div>
      )}
      <label htmlFor="sealedBid" className="block text-sm font-semibold text-gray-700">
        {auction.mySealedBid != null ? "Change your bid" : "Submit a sealed bid"}
      </label>
      <div className="flex gap-2">
        <RupeeInput
          id="sealedBid"
          value={amount}
          onChange={setAmount}
          placeholder={String(auction.startingPrice)}
          min={auction.startingPrice}
          required
        />
        <button type="submit" disabled={isPending} className={primaryButton(isPending)}>
          {isPending ? "Sealing..." : "Seal Bid"}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        If you win, you pay the second-highest bid, not your own.
      </p>
    </form>
  );
};

export const BidPanel = ({ auction, currentUserId }) => {
  const startsIn = new Date(auction.itemStartDate) - new Date();
  if (startsIn > 0) {
    return (
      <div className="bg-brand-50 border border-brand-100 text-brand-800 text-sm font-medium rounded-2xl p-5 text-center">
        Opens in {formatTimeLeft(startsIn).replace(" left", "")}
      </div>
    );
  }
  if (auction.format === "dutch") return <DutchPanel auction={auction} />;
  if (auction.format === "sealed") return <SealedPanel auction={auction} />;
  return <EnglishPanel auction={auction} currentUserId={currentUserId} />;
};
