import { HydratedDocument, Types } from "mongoose";
import { INotification, Notification, NotificationType } from "../../models/Notification";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import { PaginationMeta, buildMeta } from "../../utils/pagination";
import { tenantFilter } from "../../utils/tenant";
import { emitToUser } from "../../sockets";

export interface NotificationDto {
  id: string;
  type: NotificationType;
  complaintId?: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

function toDto(n: HydratedDocument<INotification>): NotificationDto {
  return {
    id: String(n._id),
    type: n.type,
    ...(n.complaintId ? { complaintId: String(n.complaintId) } : {}),
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt,
  };
}

interface NotifyInput {
  organizationId: string;
  userIds: Array<string | undefined | null>;
  type: NotificationType;
  complaintId?: string;
  message: string;
  excludeUserId?: string; // normally the person who caused the event
}

// Saves a notification for each recipient and pushes it live through Socket.IO.
// Failures are logged, never thrown: a broken notification must not break a complaint update.
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const recipients = [
      ...new Set(input.userIds.filter((id): id is string => !!id && id !== input.excludeUserId)),
    ];
    if (recipients.length === 0) return;

    const docs = await Notification.insertMany(
      recipients.map((userId) => ({
        organizationId: new Types.ObjectId(input.organizationId),
        userId: new Types.ObjectId(userId),
        type: input.type,
        complaintId: input.complaintId ? new Types.ObjectId(input.complaintId) : undefined,
        message: input.message,
      }))
    );

    for (const doc of docs) {
      emitToUser(String(doc.userId), "notification", toDto(doc as HydratedDocument<INotification>));
    }
  } catch (err) {
    logger.error("Failed to create notification", err);
  }
}

export async function listNotifications(
  organizationId: string,
  userId: string,
  page: number,
  limit: number,
  unreadOnly: boolean
): Promise<{ items: NotificationDto[]; meta: PaginationMeta & { unread: number } }> {
  const base = { userId: new Types.ObjectId(userId), ...tenantFilter(organizationId) };
  const filter = unreadOnly ? { ...base, isRead: false } : base;

  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...base, isRead: false }),
  ]);
  return { items: items.map(toDto), meta: { ...buildMeta(page, limit, total), unread } };
}

export async function markRead(organizationId: string, userId: string, id: string): Promise<NotificationDto> {
  const n = await Notification.findOneAndUpdate(
    { _id: id, userId: new Types.ObjectId(userId), ...tenantFilter(organizationId) },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!n) throw ApiError.notFound("Notification not found");
  return toDto(n);
}

export async function markAllRead(organizationId: string, userId: string): Promise<number> {
  const result = await Notification.updateMany(
    { userId: new Types.ObjectId(userId), isRead: false, ...tenantFilter(organizationId) },
    { $set: { isRead: true } }
  );
  return result.modifiedCount;
}
