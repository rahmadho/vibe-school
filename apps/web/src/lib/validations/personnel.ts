import { z } from "zod";
import { optionalText, optionalPhone, optionalEmail } from "./common";

/**
 * Validasi Guru & Staf.
 * Guru punya NIP opsional + daftar mapel yang diampu (subjectIds).
 */

export const GENDERS = ["MALE", "FEMALE"] as const;
export const GENDER_LABEL: Record<(typeof GENDERS)[number], string> = {
  MALE: "Laki-laki",
  FEMALE: "Perempuan",
};

/* ============================================================
 * GURU
 * ============================================================ */
export const teacherCreateSchema = z.object({
  nip: optionalText(30),
  fullName: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(120, "Nama maksimal 120 karakter"),
  gender: z.enum(GENDERS, { message: "Pilih jenis kelamin" }),
  phone: optionalPhone,
  email: optionalEmail,
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
  /** Mapel yang diampu — bisa dikirim sebagai beberapa nilai FormData. */
  subjectIds: z
    .array(z.string().min(1))
    .optional()
    .transform((v) => v ?? []),
});

export const teacherUpdateSchema = teacherCreateSchema.extend({
  id: z.string().min(1),
});

export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;

export const teacherFilterSchema = z.object({
  q: z.string().trim().optional(),
  active: z.enum(["1", "0"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(100).default(20),
});
export type TeacherFilter = z.infer<typeof teacherFilterSchema>;

/* ============================================================
 * STAF
 * ============================================================ */
export const STAFF_POSITIONS = [
  "TATA_USAHA",
  "BENDAHARA",
  "PUSTAKAWAN",
  "LABORAN",
  "KEAMANAN",
  "KEBERSIHAN",
  "LAINNYA",
] as const;

export const STAFF_POSITION_LABEL: Record<
  (typeof STAFF_POSITIONS)[number],
  string
> = {
  TATA_USAHA: "Tata Usaha",
  BENDAHARA: "Bendahara",
  PUSTAKAWAN: "Pustakawan",
  LABORAN: "Laboran",
  KEAMANAN: "Keamanan",
  KEBERSIHAN: "Kebersihan",
  LAINNYA: "Lainnya",
};

export const staffCreateSchema = z.object({
  nip: optionalText(30),
  fullName: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(120, "Nama maksimal 120 karakter"),
  position: z.enum(STAFF_POSITIONS).optional(),
  phone: optionalPhone,
  email: optionalEmail,
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
});

export const staffUpdateSchema = staffCreateSchema.extend({
  id: z.string().min(1),
});

export const staffFilterSchema = teacherFilterSchema;
export type StaffFilter = z.infer<typeof staffFilterSchema>;
