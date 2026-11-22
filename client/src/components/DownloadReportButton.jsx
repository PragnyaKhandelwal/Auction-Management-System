import { MdOutlineFileDownload } from "react-icons/md";

// Button for a download mutation, with its own busy and error states
export const DownloadReportButton = ({ download, className = "" }) => {
  const { mutate, isPending, error } = download;
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => mutate()}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-semibold text-brand-700 bg-white border border-brand-200 rounded-xl hover:bg-brand-50 disabled:opacity-60 disabled:cursor-wait transition-colors"
      >
        <MdOutlineFileDownload className="w-4 h-4" aria-hidden="true" />
        {isPending ? "Preparing report..." : "Download Report (CSV)"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600 mt-2">
          {error.message}
        </p>
      )}
    </div>
  );
};
