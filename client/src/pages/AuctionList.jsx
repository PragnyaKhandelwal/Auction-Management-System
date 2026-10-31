import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import AuctionCard from "../components/AuctionCard";
import { useGetAuctions } from "../hooks/useAuction";
import LoadingScreen from "../components/LoadingScreen";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { CATEGORIES, FORMATS } from "../utils/auction";

const selectClasses =
  "px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition";

export const AuctionList = () => {
  useDocumentTitle("Browse Auctions");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [format, setFormat] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { data, isLoading } = useGetAuctions(page, {
    q,
    category,
    format,
    sort,
  });

  // Search once typing pauses, not on every key
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (isLoading) return <LoadingScreen />;

  const auctions = data?.auctions || [];
  const pagination = data?.pagination || {};

  const updateFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
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

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Auctions</h1>
          <p className="text-sm text-gray-400 mt-1">
            Browse {pagination.total || 0} active listings
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-3">
          <div className="flex flex-wrap gap-2">
            {[["", "All formats"], ...Object.entries(FORMATS).map(([key, f]) => [key, f.label])].map(
              ([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setFormat(key);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    format === key
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lots, e.g. watch or saree"
              aria-label="Search auctions"
              className={`${selectClasses} flex-1`}
            />
            <select
              value={category}
              onChange={updateFilter(setCategory)}
              aria-label="Category"
              className={selectClasses}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={updateFilter(setSort)}
              aria-label="Sort by"
              className={selectClasses}
            >
              <option value="newest">Newest first</option>
              <option value="ending">Ending soonest</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
            </select>
          </div>
        </div>

        {auctions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200/80 shadow-sm">
            <svg
              className="w-12 h-12 text-gray-200 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-gray-400">No auctions match these filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {auctions.map((auction) => (
              <AuctionCard key={auction._id} auction={auction} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-xl text-sm font-semibold transition ${
                    p === page
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-brand-300 hover:text-brand-600"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
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
