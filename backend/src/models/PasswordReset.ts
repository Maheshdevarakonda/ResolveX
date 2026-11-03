import { Schema, Types, model } from "mongoose";

export interface IPasswordReset {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  tokenHash: string; // only the SHA-256 hash is stored
  expiresAt: Date;
  usedAt: Date | null;
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-delete when expired

export const PasswordReset = model<IPasswordReset>("PasswordReset", passwordResetSchema);
