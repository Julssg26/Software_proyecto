import { api } from "./api";
import type { AppNotification, NotificationType } from "../lib/types";

export interface ApiNotification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export const notificationsApi = {
  listMine: () => api<{ notifications: ApiNotification[] }>("/notifications"),
  markRead: (id: string) =>
    api<{ notification: ApiNotification }>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => api<{ message: string }>("/notifications/read-all", { method: "PATCH" }),
};

export function toNotification(n: ApiNotification): AppNotification {
  return {
    id: n._id,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    fecha: n.createdAt,
  };
}
