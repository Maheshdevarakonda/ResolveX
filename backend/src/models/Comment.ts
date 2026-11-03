import { Schema, Types, model } from "mongoose";

export interface IComment {
  organizationId: Types.ObjectId;
  complaintId: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  isInternal: boolean; // internal notes are visible to staff only
  createdAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    complaintId: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    isInternal: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

commentSchema.index({ organizationId: 1, complaintId: 1, createdAt: 1 });

export const Comment = model<IComment>("Comment", commentSchema);
