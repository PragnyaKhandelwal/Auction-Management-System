import { api } from "../config/api.js";

// Whether the server offers Google sign-in, and its public client ID
export const getGoogleConfig = async () => {
  const res = await api.get(`/auth/google/config`);
  return res.data;
};

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiPromise;

// Loads Google Identity Services once per page
export const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  gsiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google)
        : reject(new Error("Google sign-in did not load"));
    script.onerror = () => {
      gsiPromise = undefined; // allow a retry on the next visit
      reject(new Error("Google sign-in could not load"));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
};
