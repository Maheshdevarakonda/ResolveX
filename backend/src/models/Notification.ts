import { Schema, Types, model } from "mongoose";

export const NOTIFICATION_TYPES = [
  "COMPLAINT_CREATED",
  "ASSIGNED",
  "STATUS_CHANGED",
  "COMMENT",
  "ESCALATED",
  "SLA_WARNING",
  "REOPENED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  complaintId?: Types.ObjectId;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    complaintId: { type: Schema.Types.ObjectId, ref: "Complaint" },
    message: { type: String, required: true, maxlength: 300 },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = model<INotification>("Notification", notificationSchema);
