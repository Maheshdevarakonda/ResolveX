import { Types } from "mongoose";
import { User } from "../models/User";

// All active admins of an organization (recipients of "new complaint" and "escalated" alerts).
export async function adminIds(organizationId: string): Promise<string[]> {
  const admins = await User.find({
    organizationId: new Types.ObjectId(organizationId),
    role: "ADMIN",
    isActive: true,
  })
    .select("_id")
    .lean();
  return admins.map((a) => String(a._id));
}
