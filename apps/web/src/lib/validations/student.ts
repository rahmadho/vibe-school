import { z } from "zod";
import {
  normalizePhone,
  optionalText,
  optionalPhone,
  optionalId,
} from "./common";

export { normalizePhone };

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

const phoneField = optionalPhone;

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
  classId: optionalId,
  /** Jurusan/peminatan siswa. Kosong = belum ditentukan. */
  majorId: optionalId,
  status: z.enum(STUDENT_STATUSES).default("ACTIVE"),
  // Wali (opsional saat daftar; bisa dilengkapi di detail)
  parentName: optionalText(120),
  // Kosong harus menjadi `undefined`, bukan string "" — form selalu mengirim
  // field ini, dan `z.enum` menolak "" sehingga seluruh form siswa gagal simpan.
  parentRelation: z
    .union([z.literal(""), z.enum(["FATHER", "MOTHER", "GUARDIAN"])])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  parentPhone: phoneField,
});

export const studentUpdateSchema = studentCreateSchema.extend({
  id: z.string().min(1),
});

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;

/**
 * Nilai khusus untuk filter kelas: "none" = siswa yang BELUM ditempatkan.
 *
 * KENAPA PERLU: siswa baru hasil konversi SPMB sering belum dimasukkan ke
 * kelas, dan justru merekalah yang perlu dicari panitia. Tanpa nilai ini,
 * siswa tanpa kelas tidak bisa muncul di daftar mana pun — ia tidak punya
 * `classId` yang bisa dipilih.
 *
 * "none" tidak mungkin bertabrakan dengan id kelas asli: id Prisma berawalan
 * "c" diikuti karakter acak, tidak pernah berupa kata "none".
 */
export const CLASS_FILTER_NONE = "none";

export const studentFilterSchema = z.object({
  q: z.string().trim().optional(),
  classId: z.string().trim().optional(),
  majorId: z.string().trim().optional(),
  /**
   * Tahun ajaran kelas. Menyaring lewat `class.academicYearId`, bukan kolom
   * siswa — siswa tidak menyimpan tahun ajaran sendiri.
   */
  academicYearId: z.string().trim().optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(100).default(20),
});

export type StudentFilter = z.infer<typeof studentFilterSchema>;
