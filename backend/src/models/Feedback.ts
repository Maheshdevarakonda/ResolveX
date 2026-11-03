import { Schema, Types, model } from "mongoose";

export interface IFeedback {
  organizationId: Types.ObjectId;
  complaintId: Types.ObjectId;
  customerId: Types.ObjectId;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    complaintId: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One feedback per complaint.
feedbackSchema.index({ complaintId: 1 }, { unique: true });
feedbackSchema.index({ organizationId: 1, createdAt: -1 });

export const Feedback = model<IFeedback>("Feedback", feedbackSchema);
