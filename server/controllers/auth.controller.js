import User from "../models/user.model.js";
import Login from "../models/login.model.js";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/jwt.js";
import { getClientIp, getLocationFromIp } from "../utils/geoDetails.js";
import { clearCookie, setCookie } from "../utils/cookies.util.js";
import jwt from "jsonwebtoken";
import { env } from "../config/env.config.js";
import { PUBLIC_USER_FIELDS, toPublicUser } from "../utils/publicUser.js";
import {
  GoogleAuthError,
  findOrCreateGoogleUser,
  googleEnabled,
  verifyGoogleCredential,
} from "../services/googleAuth.service.js";

export const handleUserLogin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "All Fields are required" });
  try {
    const user = await User.findOne({ email });
    //  Checking user exists — use same message to prevent user enumeration
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Accounts created with Google have no password: same message as a wrong one
    if (!user.password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Password Validate
    const psswordValidate = await bcrypt.compare(password, user.password);
    if (!psswordValidate) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // generating jwt token
    const token = generateToken(user._id, user.role);

    // Set HTTP-only cookie
    setCookie(res, token);

    // Getting user gro location
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const location = await getLocationFromIp(ip);

    // Update user's last login and location
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      location: location,
      ipAddress: ip,
      userAgent: userAgent,
    });

    // Saving login details
    const login = new Login({
      userId: user._id,
      ipAddress: ip,
      userAgent,
      location,
      loginAt: new Date(),
    });
    await login.save();

    return res.status(200).json({ message: "Login Successful" });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: "Server error from handle login" });
  }
};

export const handleUserSignup = async (req, res) => {
  const { name, email, password } = req.body;

  // Checking input fields
  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Server-side password strength validation
  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters long" });
  }

  try {
    const existingUser = await User.findOne({ email });

    // Checking existing of user
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    // Getting geo details
    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const location = await getLocationFromIp(ip);

    // Hashing user password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Saving user to database
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      ipAddress: ip,
      userAgent,
      location,
      signupAt: new Date(),
      lastLogin: new Date(),
    });
    await newUser.save();

    const login = new Login({
      userId: newUser._id,
      ipAddress: ip,
      userAgent,
      location,
      loginAt: new Date(),
    });
    await login.save();

    // Generating jwt token
    const token = generateToken(newUser._id, newUser.role);

    // Set HTTP-only cookie
    setCookie(res, token);

    return res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Server error" });
  }
};

export const handleUserLogout = async (req, res) => {
  clearCookie(res);
  return res.status(200).json({ message: "Logged out successfully" });
};

// Who is signed in, if anyone. Answers 200 either way, so a logged-out visit
// does not log a failed request in the browser console.
export const handleSession = async (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(200).json({ user: null });
  try {
    const { id } = jwt.verify(token, env.jwt_secret);
    const user = await User.findById(id).select(PUBLIC_USER_FIELDS).lean();
    if (!user) return res.status(200).json({ user: null });
    res.status(200).json({ user: toPublicUser(user) });
  } catch {
    res.status(200).json({ user: null });
  }
};

// Whether the login and signup pages should offer "Continue with Google"
export const handleGoogleConfig = (req, res) => {
  res.status(200).json({
    enabled: googleEnabled(),
    clientId: googleEnabled() ? env.google_client_id : null,
  });
};

// Signs in with a Google ID token: links Google to an account with the same
// verified email, or creates a new account, then issues the usual JWT cookie.
export const handleGoogleLogin = async (req, res) => {
  if (!googleEnabled()) {
    return res.status(404).json({ error: "Google sign-in is not available" });
  }
  const { credential } = req.body ?? {};
  if (typeof credential !== "string" || !credential) {
    return res.status(400).json({ error: "Missing Google credential" });
  }

  let profile;
  try {
    profile = await verifyGoogleCredential(credential);
  } catch {
    return res
      .status(401)
      .json({ error: "Google sign-in failed. Please try again." });
  }

  try {
    const { user, created, linked } = await findOrCreateGoogleUser(profile);

    setCookie(res, generateToken(user._id, user.role));

    const ip = getClientIp(req);
    const userAgent = req.headers["user-agent"];
    const location = await getLocationFromIp(ip);
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      location,
      ipAddress: ip,
      userAgent,
    });
    await Login.create({
      userId: user._id,
      ipAddress: ip,
      userAgent,
      location,
      loginAt: new Date(),
    });

    return res
      .status(created ? 201 : 200)
      .json({ message: "Login Successful", created, linked });
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Google Login Error:", error);
    return res.status(500).json({ error: "Server error from Google sign-in" });
  }
};
