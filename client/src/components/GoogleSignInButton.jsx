/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { googleLogin } from "../store/auth/authSlice";
import { getGoogleConfig, loadGoogleIdentity } from "../services/google.service";

// "Continue with Google" for the login and signup pages. Renders nothing when
// the server has no GOOGLE_CLIENT_ID, so the pages look as before.
export const GoogleSignInButton = ({ text = "continue_with" }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["googleConfig"],
    queryFn: getGoogleConfig,
    staleTime: Infinity,
    retry: false,
  });
  const clientId = config?.enabled ? config.clientId : null;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const onCredential = async ({ credential }) => {
      setError("");
      setBusy(true);
      try {
        await dispatch(googleLogin(credential)).unwrap();
        navigate("/");
      } catch (message) {
        setError(message || "Google sign-in failed");
      } finally {
        setBusy(false);
      }
    };

    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: onCredential,
          ux_mode: "popup",
        });
        google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text,
          width: buttonRef.current.offsetWidth || 320,
        });
      })
      .catch(() => {
        if (!cancelled) setError("Google sign-in is unavailable right now.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, text, dispatch, navigate]);

  if (!clientId) return null;

  return (
    <div className="mt-6" aria-busy={busy}>
      <div className="flex items-center gap-3 mb-4" aria-hidden="true">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          or
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div
        ref={buttonRef}
        className={`flex justify-center min-h-[44px] ${busy ? "opacity-60 pointer-events-none" : ""}`}
      />
      {busy && (
        <p className="text-xs text-gray-500 text-center mt-2">Signing you in...</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 text-center mt-2">
          {error}
        </p>
      )}
    </div>
  );
};
