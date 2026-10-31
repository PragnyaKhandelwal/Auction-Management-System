import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { connectSocket } from "../config/socket.js";
import {
  getNotifications,
  markNotificationsRead,
} from "../services/notification.service.js";

export const useNotifications = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
  });

  useEffect(() => {
    const socket = connectSocket();
    const handleNew = ({ message }) => {
      toast(message, { icon: "🔔" });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    socket.on("notification:new", handleNew);
    return () => socket.off("notification:new", handleNew);
  }, [queryClient]);

  const { mutate: markRead } = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return {
    notifications: query.data?.notifications ?? [],
    unread: query.data?.unread ?? 0,
    markRead,
  };
};
