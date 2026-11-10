import { z } from "zod";
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
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  address: optionalText(200),
  barangay: optionalText(80),
});

export const reportEditSchema = reportSchema.pick({ title: true, description: true, categorySlug: true, address: true, barangay: true }).partial();

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
