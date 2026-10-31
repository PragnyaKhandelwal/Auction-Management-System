import Notification from "../models/notification.model.js";
import { getIO } from "../socket/index.js";

// Saves one notification per user and pushes it to their private socket room
export const notify = async (userIds, { type, message, auction }) => {
  const unique = [...new Set(userIds.map((id) => id.toString()))];
  if (unique.length === 0) return;

  const saved = await Notification.insertMany(
    unique.map((user) => ({ user, type, message, auction })),
  );

  try {
    const io = getIO();
    for (const doc of saved) {
      io.to(`user:${doc.user}`).emit("notification:new", doc);
    }
  } catch (socketErr) {
    // No socket server on serverless: the bell still loads these over REST
    console.error("Notification push skipped:", socketErr.message);
  }
};
