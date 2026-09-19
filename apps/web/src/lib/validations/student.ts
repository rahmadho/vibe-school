import { z } from "zod";

/**
 * Skema validasi Siswa — dipakai bersama oleh:
 *  - form (client, validasi awal untuk pesan cepat)
 *  - server action (client TIDAK dipercaya; validasi wajib di server)
 *
 * Seperti biasa: `schoolId` TIDAK ada di sini. Itu diambil dari sesi dan
 * disuntikkan oleh scopedDb, bukan dari input pengguna.
 */

export const GENDERS = ["MALE", "FEMALE"] as const;
export const STUDENT_STATUSES = [
  "ACTIVE",
  "GRADUATED",
  "TRANSFERRED",
  "DROPPED_OUT",
  "SUSPENDED",
] as const;

/** Label bahasa Indonesia untuk enum (dipakai di UI). */
export const GENDER_LABEL: Record<(typeof GENDERS)[number], string> = {
  MALE: "Laki-laki",
  FEMALE: "Perempuan",
};

export const STUDENT_STATUS_LABEL: Record<
  (typeof STUDENT_STATUSES)[number],
  string
> = {
  ACTIVE: "Aktif",
  GRADUATED: "Lulus",
  TRANSFERRED: "Pindah",
  DROPPED_OUT: "Keluar",
  SUSPENDED: "Skorsing",
};

const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

/** Nomor HP: normalisasi ke E.164 tanpa '+' (62812...). */
export function normalizePhone(input: string): string | undefined {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
}

const phoneField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? normalizePhone(v) : undefined))
  .refine((v) => v === undefined || /^62\d{8,14}$/.test(v), {
    message: "Nomor HP tidak valid (contoh: 081234567890)",
  });

export const studentCreateSchema = z.object({
  nis: z
    .string()
    .trim()
    .min(1, "NIS wajib diisi")
    .max(30, "NIS maksimal 30 karakter"),
  nisn: optionalText(20),
  fullName: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(120, "Nama maksimal 120 karakter"),
  gender: z.enum(GENDERS, { message: "Pilih jenis kelamin" }),
  birthPlace: optionalText(80),
  birthDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
    .refine((d) => d === undefined || !Number.isNaN(d.getTime()), {
      message: "Tanggal lahir tidak valid",
    }),
  religion: optionalText(40),
  address: optionalText(300),
  phone: phoneField,
  entryYear: z.coerce
    .number()
    .int("Tahun harus bilangan bulat")
    .min(1990, "Tahun terlalu lampau")
    .max(2100, "Tahun terlalu jauh"),
  classId: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  status: z.enum(STUDENT_STATUSES).default("ACTIVE"),
  // Wali (opsional saat daftar; bisa dilengkapi di detail)
  parentName: optionalText(120),
  parentRelation: z
    .enum(["FATHER", "MOTHER", "GUARDIAN"])
    .optional(),
  parentPhone: phoneField,
});

export const studentUpdateSchema = studentCreateSchema.extend({
  id: z.string().min(1),
});

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;

/** Filter daftar siswa (query string). */
export const studentFilterSchema = z.object({
  q: z.string().trim().optional(),
  classId: z.string().trim().optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(100).default(20),
});

export type StudentFilter = z.infer<typeof studentFilterSchema>;
