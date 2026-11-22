import mongoose from "mongoose";
import Notification from "../models/notification.model.js";

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);
    const unread = await Notification.countDocuments({
      user: req.user.id,
      read: false,
    });
    res.status(200).json({ notifications, unread });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching notifications", error: error.message });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true } },
    );
    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating notifications", error: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (typeof req.body?.read !== "boolean") {
      return res.status(400).json({ message: "read must be a boolean" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { read: req.body.read } },
      { new: true, runValidators: true },
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    const unread = await Notification.countDocuments({
      user: req.user.id,
      read: false,
    });

    res.status(200).json({ notification, unread });
  } catch (error) {
    if (error instanceof mongoose.CastError) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res
      .status(500)
      .json({ message: "Error updating notification", error: error.message });
  }
};
