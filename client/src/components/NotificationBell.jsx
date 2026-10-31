import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { IoNotificationsOutline } from "react-icons/io5";
import { useNotifications } from "../hooks/useNotifications.js";

const timeAgo = (date) => {
  const minutes = Math.floor((Date.now() - new Date(date)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const NotificationBell = () => {
  const { notifications, unread, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = () => {
    if (!open && unread > 0) markRead();
    setOpen(!open);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggle}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
      >
        <IoNotificationsOutline className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-gray-900 text-[10px] font-bold flex items-center justify-center tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden z-50">
          <p className="px-4 py-3 text-sm font-semibold text-gray-800 border-b border-gray-100">
            Notifications
          </p>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              Nothing yet. Outbids, wins and closing reminders appear here.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {notifications.map((n) => (
                <li key={n._id}>
                  <Link
                    to={n.auction ? `/auction/${n.auction}` : "#"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 hover:bg-gray-50 transition ${
                      n.read ? "" : "bg-brand-50/60"
                    }`}
                  >
                    <p className="text-sm text-gray-700">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {timeAgo(n.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
