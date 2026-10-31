import { useState } from "react";
import { Link } from "react-router";
import AuctionCard from "../components/AuctionCard";
import LoadingScreen from "../components/LoadingScreen";
import { useGetWatchlist } from "../hooks/useAuction";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export const Watchlist = () => {
  useDocumentTitle("Watchlist");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetWatchlist(page);

  if (isLoading) return <LoadingScreen />;

  const auctions = data?.auctions || [];
  const pagination = data?.pagination || {};

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Watchlist</h1>
          <p className="text-sm text-gray-400 mt-1">
            We remind you 10 minutes before these close
          </p>
        </div>

        {auctions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200/80 shadow-sm">
            <p className="text-gray-400 mb-4">
              You are not watching anything yet
            </p>
            <Link
              to="/auction"
              className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-700 transition-all shadow-sm shadow-brand-200"
            >
              Browse auctions
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {auctions.map((auction) => (
              <AuctionCard key={auction._id} auction={auction} />
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500 tabular-nums px-2">
              {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={page === pagination.totalPages}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
