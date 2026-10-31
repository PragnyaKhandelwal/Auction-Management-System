import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { MdErrorOutline, MdInfoOutline, MdWarningAmber } from "react-icons/md";
import LoadingScreen from "../../components/LoadingScreen";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { getFairPlayReport } from "../../services/admin.service";

const severityStyles = {
  high: {
    label: "High",
    Icon: MdErrorOutline,
    className: "bg-red-50 text-red-700 border-red-100",
  },
  medium: {
    label: "Medium",
    Icon: MdWarningAmber,
    className: "bg-amber-50 text-amber-800 border-amber-100",
  },
  low: {
    label: "Low",
    Icon: MdInfoOutline,
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
};

export const FairPlay = () => {
  useDocumentTitle("Fair Play Monitor");
  const { data, isLoading, error } = useQuery({
    queryKey: ["fairPlay"],
    queryFn: getFairPlayReport,
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Fair Play Monitor
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Bidding patterns that may point to shill bidding. These are prompts
            for a human review, not proof of wrongdoing.
          </p>
          {data && (
            <p className="text-xs text-gray-400 mt-2">
              Scanned {data.scanned} auctions with bids from the last{" "}
              {data.lookbackDays} days
            </p>
          )}
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error.response?.data?.message || "Could not load the report."}
          </div>
        ) : data.flags.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200/80 shadow-sm text-gray-400">
            No suspicious patterns found.
          </div>
        ) : (
          <ul className="space-y-3">
            {data.flags.map((flag, i) => {
              const { label, Icon, className } = severityStyles[flag.severity];
              return (
                <li
                  key={i}
                  className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold text-gray-900 font-sans">
                      {flag.title}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${className}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5">{flag.detail}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                    {flag.auctions.map((a) => (
                      <Link
                        key={a._id}
                        to={`/auction/${a._id}`}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        {a.itemName}
                      </Link>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
