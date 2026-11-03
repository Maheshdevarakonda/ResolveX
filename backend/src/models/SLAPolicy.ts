import { Schema, Types, model } from "mongoose";
import { PRIORITIES, Priority } from "./Complaint";

export interface ISLAPolicy {
  organizationId: Types.ObjectId;
  priority: Priority;
  responseMinutes: number; // time allowed until the first staff response
  resolutionMinutes: number; // time allowed until the complaint is resolved
}

const slaPolicySchema = new Schema<ISLAPolicy>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    priority: { type: String, enum: PRIORITIES, required: true },
    responseMinutes: { type: Number, required: true, min: 5, max: 43200 },
    resolutionMinutes: { type: Number, required: true, min: 5, max: 43200 },
  },
  { timestamps: true }
);

slaPolicySchema.index({ organizationId: 1, priority: 1 }, { unique: true });

export const SLAPolicy = model<ISLAPolicy>("SLAPolicy", slaPolicySchema);
