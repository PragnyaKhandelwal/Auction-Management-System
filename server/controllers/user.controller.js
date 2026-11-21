import Login from "../models/login.model.js";
import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { PUBLIC_USER_FIELDS, toPublicUser } from "../utils/publicUser.js";

export const handleGetUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select(PUBLIC_USER_FIELDS)
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const handleChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body ?? {};

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    // Accounts created with Google have no password yet, so they set a first one
    const settingFirstPassword = !user.password;

    if (
      (!settingFirstPassword && !currentPassword) ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({ error: "Please enter all fields" });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ error: "New password and confirm password do not match." });
    }
    if (!settingFirstPassword && currentPassword === newPassword) {
      return res
        .status(400)
        .json({ error: "You can't reuse the old password." });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "New password must be at least 8 characters long." });
    }

    if (!settingFirstPassword) {
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Current password is incorrect." });
      }
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      message: settingFirstPassword
        ? "Password set. You can now also log in with your email."
        : "Password changed successfully.",
    });
  } catch (err) {
    console.error("Error changing password:", err);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

export const getLoginHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const logins = await Login.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) },
      },
      {
        $sort: { loginAt: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    const formatted = logins.map((login) => {
      const date = new Date(login.loginAt);
      const formattedDate = date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const location = [
        login.location?.city,
        login.location?.region,
        login.location?.country,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        id: login._id,
        dateTime: formattedDate,
        ipAddress: login.ipAddress || "Unknown",
        location: location || "Unknown",
        isp: login.location?.isp || "Unknown",
        device: getDeviceType(login.userAgent),
      };
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error("Error fetching login history:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch login logs",
    });
  }
};

function getDeviceType(userAgent = "") {
  userAgent = userAgent.toLowerCase();
  if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(userAgent))
    return "Mobile";
  if (/tablet|ipad|android(?!.*mobile)/.test(userAgent)) return "Tablet";
  return "Desktop";
}
