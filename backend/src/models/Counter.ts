import { Schema, Types, model } from "mongoose";

// Gives each organization its own ticket sequence: RX-000001, RX-000002, ...
// $inc is atomic in MongoDB, so two complaints created at the same moment never get the same number.
interface ICounter {
  organizationId: Types.ObjectId;
  key: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.index({ organizationId: 1, key: 1 }, { unique: true });

export const Counter = model<ICounter>("Counter", counterSchema);

export async function nextTicketNo(organizationId: Types.ObjectId): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { organizationId, key: "complaint" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `RX-${String(counter.seq).padStart(6, "0")}`;
}
