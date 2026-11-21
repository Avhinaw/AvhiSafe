export type NotificationType = "security" | "sync" | "system" | "portfolio";
export type NotificationStatus = "unread" | "read" | "archived";

export interface NotificationDocument {
  _id: string;
  userId: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  body: string;
  severity?: "info" | "success" | "warning" | "error";
  resourceType?: string;
  resourceId?: string;
  createdAt: Date;
  readAt?: Date;
  expiresAt?: Date;
}
