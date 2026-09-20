import { z } from "zod";
import { optionalId, academicYearName } from "./common";

/**
 * Validasi entitas akademik: Tahun Ajaran, Kelas, Mapel.
 */

/* ============================================================
 * TAHUN AJARAN
 * ============================================================ */
const dateString = z
  .string()
  .trim()
  .min(1, "Tanggal wajib diisi")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Tanggal tidak valid");

export const academicYearCreateSchema = z
  .object({
    name: academicYearName,
    startDate: dateString,
    endDate: dateString,
  })
  .refine((d) => d.endDate > d.startDate, {
    message: "Tanggal selesai harus setelah tanggal mulai",
    path: ["endDate"],
  });

export const academicYearUpdateSchema = academicYearCreateSchema;

/* ============================================================
 * KELAS
 * ============================================================ */
export const classCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kelas wajib diisi")
    .max(20, "Nama kelas maksimal 20 karakter"),
  level: z.coerce
    .number()
    .int("Tingkat harus bilangan bulat")
    .min(1, "Tingkat minimal 1")
    .max(12, "Tingkat maksimal 12"),
  capacity: z.coerce
    .number()
    .int()
    .min(1, "Kapasitas minimal 1")
    .max(100, "Kapasitas maksimal 100")
    .default(32),
  academicYearId: z.string().min(1, "Tahun ajaran wajib dipilih"),
  homeroomTeacherId: optionalId,
});

export const classUpdateSchema = classCreateSchema.extend({
  id: z.string().min(1),
});

export const classFilterSchema = z.object({
  academicYearId: z.string().trim().optional(),
  q: z.string().trim().optional(),
});

/* ============================================================
 * MATA PELAJARAN
 * ============================================================ */
export const subjectCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Kode mapel wajib diisi")
    .max(20, "Kode maksimal 20 karakter")
    .transform((v) => v.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, "Nama mapel minimal 2 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  kkm: z.coerce
    .number()
    .int("KKM harus bilangan bulat")
    .min(0, "KKM minimal 0")
    .max(100, "KKM maksimal 100")
    .default(70),
});

export const subjectUpdateSchema = subjectCreateSchema.extend({
  id: z.string().min(1),
});

export const subjectFilterSchema = z.object({
  q: z.string().trim().optional(),
});
export type AcademicYearInput = z.infer<typeof academicYearCreateSchema>;
export type ClassInput = z.infer<typeof classCreateSchema>;
export type SubjectInput = z.infer<typeof subjectCreateSchema>;

/* ============================================================
 * KENAIKAN KELAS & MUTASI
 * ============================================================ */
export const CLASS_PROGRESSION_TYPES = ["NAIK", "TINGGAL", "LULUS", "MUTASI"] as const;
export type ClassProgressionType = (typeof CLASS_PROGRESSION_TYPES)[number];

export const CLASS_PROGRESSION_LABEL: Record<ClassProgressionType, string> = {
  NAIK: "Naik Kelas",
  TINGGAL: "Tinggal Kelas",
  LULUS: "Lulus",
  MUTASI: "Pindah / Mutasi",
};

export const progressionItemSchema = z.object({
  studentId: z.string().min(1, "ID siswa wajib"),
  result: z.enum(CLASS_PROGRESSION_TYPES, { message: "Status kenaikan tidak valid" }),
  targetClassId: z.string().trim().optional(),
  note: z.string().trim().max(200, "Catatan maksimal 200 karakter").optional(),
});

export const bulkProgressionSchema = z.object({
  sourceClassId: z.string().min(1, "Kelas asal wajib dipilih"),
  sourceAcademicYearId: z.string().min(1, "Tahun ajaran asal wajib dipilih"),
  targetAcademicYearId: z.string().min(1, "Tahun ajaran tujuan wajib dipilih"),
  items: z.array(progressionItemSchema).min(1, "Minimal pilih 1 siswa"),
});

export type ProgressionItemInput = z.infer<typeof progressionItemSchema>;
export type BulkProgressionInput = z.infer<typeof bulkProgressionSchema>;
