import { InferSchemaType, Schema, model } from "mongoose";

// One document per tenant (company / college / branch).
// `slug` is the short public name used in URLs and at login, e.g. "acme-telecom".
const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    slug: {
      type: String,
      required: true,
      unique: true, // creates the unique index
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      minlength: 3,
      maxlength: 40,
    },
    isActive: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false },
    // Organization-level settings an admin can change.
    settings: {
      // If false, new customers cannot self-register (admin-managed accounts only).
      allowCustomerRegistration: { type: Boolean, default: true },
      // How many days after resolution a customer may reopen a complaint (used in Phase 5).
      reopenWindowDays: { type: Number, default: 7, min: 1, max: 90 },
    },
  },
  { timestamps: true }
);

export type IOrganization = InferSchemaType<typeof organizationSchema>;
export const Organization = model("Organization", organizationSchema);
