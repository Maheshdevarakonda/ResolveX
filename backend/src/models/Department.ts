import { Schema, Types, model } from "mongoose";

export interface IDepartment {
  organizationId: Types.ObjectId;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

// One department name per organization. strength 2 makes it case-insensitive ("Billing" = "billing").
departmentSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export const Department = model<IDepartment>("Department", departmentSchema);
