import { z } from "zod";

// Zod strips unknown keys by default, so a client can never sneak in
// fields like { role: "ADMIN" } (mass-assignment protection).

const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);

// bcrypt only reads the first 72 bytes, so we cap the length at 72.
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

const organizationSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

const name = z.string().trim().min(2, "Name is too short").max(80);

// Shared with other modules (e.g. admin creating an employee) so rules stay identical everywhere.
export const fields = { email, password, name };

export const registerOrgSchema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  organizationSlug,
  name,
  email,
  password,
});

export const registerCustomerSchema = z.object({
  organizationSlug,
  name,
  email,
  password,
});

// Login does not enforce the password rules: we only check what is stored.
export const loginSchema = z.object({
  organizationSlug,
  email,
  password: z.string().min(1, "Password is required").max(72),
});

export const forgotPasswordSchema = z.object({
  organizationSlug,
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password,
});

export type RegisterOrgInput = z.infer<typeof registerOrgSchema>;
export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
