import { z } from "zod";
import { ROLES } from "./permissions";
import { STATUSES } from "./status";

const email = z.string().trim().toLowerCase().email().max(254);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : undefined));

export const reportSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(120),
  description: z.string().trim().min(10, "Please describe the issue in a bit more detail").max(2000),
  categorySlug: z.string().trim().min(1).max(50),
  problemTypeSlug: optionalText(60),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  address: optionalText(200),
  barangay: optionalText(80),
});

export const reportEditSchema = reportSchema.pick({ title: true, description: true, categorySlug: true, problemTypeSlug: true, address: true, barangay: true }).partial();

export const communitySchema = z.object({ text: z.string().trim().min(1).max(1000) });

export const transitionSchema = z.object({
  to: z.enum(STATUSES),
  note: z.string().trim().max(500).optional(),
  duplicateOf: z.string().uuid().optional(),
});

export function parseBbox(value: string | null): [number, number, number, number] | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return undefined;
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng > maxLng || minLat > maxLat) return undefined;
  return [minLng, minLat, maxLng, maxLat];
}

export const forgotSchema = z.object({ email });

export const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const profileSchema = z.object({ name: z.string().trim().min(2).max(80) });

export const deleteAccountSchema = z.object({ confirm: z.literal("DELETE") });

export const newUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  role: z.enum(ROLES),
  categoryIds: z.array(z.number().int().positive()).max(50).optional(),
});

export const userPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    role: z.enum(ROLES),
    isActive: z.boolean(),
    categoryIds: z.array(z.number().int().positive()).max(50),
    resetPassword: z.literal(true),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");
