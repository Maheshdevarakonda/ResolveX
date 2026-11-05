import { HydratedDocument } from "mongoose";
import { IOrganization, Organization } from "../../models/Organization";
import { SafeUser, User, toSafeUser } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { PaginationMeta, buildMeta } from "../../utils/pagination";
import { tenantFilter } from "../../utils/tenant";
import { ListMembersQuery, UpdateOrganizationInput } from "./organization.schema";

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isDemo?: boolean;
  settings: { allowCustomerRegistration: boolean; reopenWindowDays: number };
  createdAt: Date;
}

function toOrganizationDto(org: HydratedDocument<IOrganization>): OrganizationDto {
  return {
    id: String(org._id),
    name: org.name,
    slug: org.slug,
    isActive: org.isActive,
    isDemo: org.isDemo ?? false,
    settings: {
      allowCustomerRegistration: org.settings?.allowCustomerRegistration ?? true,
      reopenWindowDays: org.settings?.reopenWindowDays ?? 7,
    },
    createdAt: org.createdAt,
  };
}

// The organization id always comes from the logged-in user, so an admin can only ever
// read or change THEIR OWN organization. There is no "organization id" in the URL to tamper with.
export async function getOrganization(organizationId: string): Promise<OrganizationDto> {
  const org = await Organization.findById(organizationId);
  if (!org) throw ApiError.notFound("Organization not found");
  return toOrganizationDto(org);
}

export async function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput
): Promise<OrganizationDto> {
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.settings?.allowCustomerRegistration !== undefined) {
    set["settings.allowCustomerRegistration"] = input.settings.allowCustomerRegistration;
  }
  if (input.settings?.reopenWindowDays !== undefined) {
    set["settings.reopenWindowDays"] = input.settings.reopenWindowDays;
  }
  if (Object.keys(set).length === 0) {
    throw ApiError.badRequest("No valid fields to update");
  }

  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { $set: set },
    { new: true, runValidators: true }
  );
  if (!org) throw ApiError.notFound("Organization not found");
  return toOrganizationDto(org);
}

export async function listMembers(
  organizationId: string,
  query: ListMembersQuery
): Promise<{ items: SafeUser[]; meta: PaginationMeta }> {
  const filter = {
    ...(query.role ? { role: query.role } : {}),
    ...tenantFilter(organizationId), // spread last: cannot be overridden
  };

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    User.countDocuments(filter),
  ]);

  return { items: users.map(toSafeUser), meta: buildMeta(query.page, query.limit, total) };
}

// A user from ANOTHER organization is reported as "not found" (404), not "forbidden" (403),
// so an attacker cannot even learn that the id exists.
export async function getMember(organizationId: string, userId: string): Promise<SafeUser> {
  const user = await User.findOne({ _id: userId, ...tenantFilter(organizationId) });
  if (!user) throw ApiError.notFound("User not found");
  return toSafeUser(user);
}
