import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.config.js";
import User from "../models/user.model.js";

export class GoogleAuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const googleEnabled = () => !!env.google_client_id;

let client;

// Checks a Google ID token (from Google Identity Services in the browser):
// signature, expiry, issuer and that it was issued for this app's client ID.
const verifyWithGoogle = async (credential) => {
  client ??= new OAuth2Client(env.google_client_id, env.google_client_secret);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: env.google_client_id,
  });
  const payload = ticket.getPayload();
  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name || payload.given_name || payload.email?.split("@")[0],
    picture: payload.picture,
  };
};

let verifier = verifyWithGoogle;
export const verifyGoogleCredential = (credential) => verifier(credential);

// Tests swap in a fake verifier so they never call Google
export const setGoogleVerifierForTests = (fn) => {
  verifier = fn ?? verifyWithGoogle;
};

// Finds the user for a verified Google profile: by Google ID, then by email
// (linking Google to that existing account), or creates a new account.
export const findOrCreateGoogleUser = async (profile) => {
  if (!profile.googleId || !profile.email) {
    throw new GoogleAuthError(401, "Google did not share an email address");
  }
  // An unverified email could belong to someone else, so never link or create on it
  if (!profile.emailVerified) {
    throw new GoogleAuthError(401, "Your Google email address is not verified");
  }

  const byGoogle = await User.findOne({ googleId: profile.googleId });
  if (byGoogle) return { user: byGoogle, created: false, linked: false };

  // Emails are matched without case, as people type them differently
  const byEmail = await User.findOne({ email: profile.email }).collation({
    locale: "en",
    strength: 2,
  });
  if (byEmail) {
    // Linked a moment ago by a simultaneous sign-in with this same Google account
    if (byEmail.googleId === profile.googleId) {
      return { user: byEmail, created: false, linked: false };
    }
    if (byEmail.googleId) {
      throw new GoogleAuthError(
        409,
        "This email is already linked to a different Google account",
      );
    }
    byEmail.googleId = profile.googleId;
    if (!byEmail.avatar && profile.picture) byEmail.avatar = profile.picture;
    await byEmail.save();
    return { user: byEmail, created: false, linked: true };
  }

  try {
    const user = await User.create({
      name: profile.name,
      email: profile.email,
      googleId: profile.googleId,
      avatar: profile.picture,
    });
    return { user, created: true, linked: false };
  } catch (error) {
    // A simultaneous sign-in created the account first: use that one
    if (error.code === 11000) {
      const existing = await User.findOne({ googleId: profile.googleId });
      if (existing) return { user: existing, created: false, linked: false };
    }
    throw error;
  }
};
