import { api } from "../config/api.js";

export const getNotifications = async () => {
  const res = await api.get(`/notifications`);
  return res.data;
};

export const markNotificationsRead = async () => {
  const res = await api.patch(`/notifications/read`);
  return res.data;
};
