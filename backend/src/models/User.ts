import { Schema, Types, model } from "mongoose";

export const ROLES = ["CUSTOMER", "EMPLOYEE", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export interface IUser {
  organizationId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  departmentId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    // select:false means queries never return the hash unless we explicitly ask for it.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Same email may exist in two different organizations, but only once inside one.
userSchema.index({ organizationId: 1, email: 1 }, { unique: true });
userSchema.index({ organizationId: 1, role: 1 });

export const User = model<IUser>("User", userSchema);

// The only shape of a user we ever send to clients (no passwordHash).
export interface SafeUser {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: string;
  isActive: boolean;
  isDemo?: boolean;
}

export function toSafeUser(user: {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
  departmentId?: Types.ObjectId;
  isActive: boolean;
  isDemo?: boolean;
}): SafeUser {
  return {
    id: String(user._id),
    organizationId: String(user.organizationId),
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.departmentId ? { departmentId: String(user.departmentId) } : {}),
    isActive: user.isActive,
    ...(user.isDemo !== undefined ? { isDemo: user.isDemo } : {}),
  };
}
