import { z } from "zod";
import { optionalPhone, optionalEmail, optionalText } from "./common";

/**
 * Validasi Sekolah (super-admin) + white-label + langganan.
 */

export const SCHOOL_LEVELS = [
  "TK",
  "SD",
  "SMP",
  "SMA",
  "SMK",
  "MI",
  "MTs",
  "MA",
  "MAK",
] as const;

export const SCHOOL_LEVEL_LABEL: Record<(typeof SCHOOL_LEVELS)[number], string> = {
  TK: "TK",
  SD: "SD",
  SMP: "SMP",
  SMA: "SMA",
  SMK: "SMK",
  MI: "MI",
  MTs: "MTs",
  MA: "MA",
  MAK: "MAK",
};

/** Slug: huruf kecil, angka, tanda hubung. Dipakai untuk subdomain. */
export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug minimal 2 karakter")
  .max(60, "Slug maksimal 60 karakter")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug hanya huruf kecil, angka, dan tanda hubung",
  );

/** Warna tema hex (white-label). */
export const hexColorField = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Warna harus format hex, mis. #1E40AF")
  .transform((v) => v.toUpperCase());

export const schoolCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama sekolah minimal 3 karakter")
    .max(160, "Nama maksimal 160 karakter"),
  slug: slugField,
  npsn: optionalText(20),
  level: z.enum(SCHOOL_LEVELS, { message: "Pilih jenjang" }),
  address: optionalText(300),
  phone: optionalPhone,
  email: optionalEmail,
  timezone: z.string().trim().default("Asia/Jakarta"),
  // White-label
  themeColor: hexColorField.optional().or(z.literal("").transform(() => undefined)),
  customDomain: optionalText(120),
  waSenderName: optionalText(80),
  // Akun admin pertama (opsional — bisa dibuat nanti di menu Pengguna)
  adminName: optionalText(120),
  adminEmail: optionalEmail,
  adminPassword: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || v.length >= 8, {
      message: "Password admin minimal 8 karakter",
    }),
});

export const schoolUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(3, "Nama sekolah minimal 3 karakter").max(160),
  npsn: optionalText(20),
  level: z.enum(SCHOOL_LEVELS),
  address: optionalText(300),
  phone: optionalPhone,
  email: optionalEmail,
  timezone: z.string().trim().default("Asia/Jakarta"),
  themeColor: hexColorField.optional().or(z.literal("").transform(() => undefined)),
  customDomain: optionalText(120),
  waSenderName: optionalText(80),
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
});

export type SchoolCreateInput = z.infer<typeof schoolCreateSchema>;
export type SchoolUpdateInput = z.infer<typeof schoolUpdateSchema>;

export const schoolFilterSchema = z.object({
  q: z.string().trim().optional(),
  active: z.enum(["1", "0"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(100).default(20),
});
export type SchoolFilter = z.infer<typeof schoolFilterSchema>;
