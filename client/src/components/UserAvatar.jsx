import { useState } from "react";

// A user's photo, or their initial if they have none or it fails to load
export const UserAvatar = ({ user, className = "", textClassName = "" }) => {
  const [failedSrc, setFailedSrc] = useState(null);
  const src = user?.avatar;
  const initial = user?.name?.charAt(0)?.toUpperCase() || "?";

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={user?.name ? `${user.name}'s avatar` : "User avatar"}
        className={`object-cover ${className}`}
        onError={() => setFailedSrc(src)}
      />
    );
  }
  return (
    <span
      className={`flex items-center justify-center font-bold bg-brand-100 text-brand-600 ${className} ${textClassName}`}
      aria-label={user?.name ? `${user.name}'s avatar` : "User avatar"}
      role="img"
    >
      {initial}
    </span>
  );
};
