import { Schema, Types, model } from "mongoose";

// We store only a SHA-256 hash of each refresh token, never the token itself.
// If the database leaked, the hashes alone could not be used to log in.
//
// `family` groups all tokens created from one login. When a token is used twice
// (a sign of theft) we revoke the whole family.
export interface IRefreshToken {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// TTL index: MongoDB deletes the document automatically once expiresAt has passed.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>("RefreshToken", refreshTokenSchema);
