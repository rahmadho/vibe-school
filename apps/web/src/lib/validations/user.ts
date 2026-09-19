import { z } from "zod";
import { optionalPhone } from "./common";

/**
 * Validasi User & Role.
 *
 * Catatan desain: `User.email` unik secara GLOBAL (bukan per-sekolah) karena
 * dipakai sebagai kredensial login. Satu email = satu akun.
 */

export const USER_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TREASURER",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "STAFF",
  "CONTENT_EDITOR",
] as const;

export type UserRoleValue = (typeof USER_ROLES)[number];

export const USER_ROLE_LABEL: Record<UserRoleValue, string> = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "Admin Sekolah",
  PRINCIPAL: "Kepala Sekolah",
  TREASURER: "Bendahara",
  TEACHER: "Guru",
  STUDENT: "Siswa",
  PARENT: "Orang Tua",
  STAFF: "Staf",
  CONTENT_EDITOR: "Editor Konten",
};

/** Role yang boleh dikelola admin sekolah (super-admin dikecualikan). */
export const SCHOOL_MANAGEABLE_ROLES: UserRoleValue[] = [
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TREASURER",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "STAFF",
  "CONTENT_EDITOR",
];

export const emailField = z
  .string()
  .trim()
  .min(1, "Email wajib diisi")
  .max(160)
  .toLowerCase()
  .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email tidak valid");

/** Minimal 8 karakter demi keamanan akun sekolah. */
export const passwordField = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(128, "Password maksimal 128 karakter");

export const userCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(120, "Nama maksimal 120 karakter"),
  email: emailField,
  password: passwordField,
  role: z.enum(USER_ROLES, { message: "Pilih role" }),
  phone: optionalPhone,
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
});

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  role: z.enum(USER_ROLES),
  phone: optionalPhone,
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
});

export const passwordResetSchema = z.object({
  id: z.string().min(1),
  password: passwordField,
});

export const userFilterSchema = z.object({
  q: z.string().trim().optional(),
  role: z.enum(USER_ROLES).optional(),
  active: z.enum(["1", "0"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(100).default(20),
});
export type UserFilter = z.infer<typeof userFilterSchema>;
