import { z } from "zod";
import { optionalText } from "./common";

/**
 * Validasi Penilaian (komponen nilai & nilai siswa).
 */

export const GRADE_TYPES = [
  "ASSIGNMENT",
  "QUIZ",
  "MIDTERM",
  "FINAL",
  "PRACTICUM",
  "PROJECT",
] as const;

export type GradeTypeValue = (typeof GRADE_TYPES)[number];

export const GRADE_TYPE_LABEL: Record<GradeTypeValue, string> = {
  ASSIGNMENT: "Tugas",
  QUIZ: "Kuis/Ulangan",
  MIDTERM: "UTS",
  FINAL: "UAS",
  PRACTICUM: "Praktik",
  PROJECT: "Proyek",
};

/* ============================================================
 * KOMPONEN NILAI
 * ============================================================ */

export const gradeItemCreateSchema = z.object({
  subjectId: z.string().min(1, "Pilih mata pelajaran"),
  academicYearId: z.string().min(1, "Pilih tahun ajaran"),
  teacherId: z.string().min(1, "Pilih guru pengampu"),
  name: z
    .string()
    .trim()
    .min(1, "Nama komponen wajib diisi")
    .max(80, "Nama terlalu panjang"),
  type: z.enum(GRADE_TYPES),
  weight: z.coerce
    .number()
    .int("Bobot harus bilangan bulat")
    .min(1, "Bobot minimal 1%")
    .max(100, "Bobot maksimal 100%"),
  maxScore: z.coerce
    .number()
    .int("Nilai maksimal harus bilangan bulat")
    .min(1, "Nilai maksimal minimal 1")
    .max(1000, "Nilai maksimal terlalu besar")
    .default(100),
});

export const gradeItemUpdateSchema = gradeItemCreateSchema.extend({
  id: z.string().min(1),
});

export type GradeItemInput = z.infer<typeof gradeItemCreateSchema>;

/* ============================================================
 * NILAI SISWA
 * ============================================================ */

export const gradeEntrySchema = z.object({
  studentId: z.string().min(1),
  // Skor boleh kosong (belum dinilai) — disimpan sebagai null.
  score: z
    .union([z.coerce.number().int("Nilai harus bilangan bulat").min(0), z.null()])
    .optional(),
  note: optionalText(200),
});

export const gradeBulkSchema = z.object({
  gradeItemId: z.string().min(1, "Komponen nilai tidak diketahui"),
  classId: z.string().min(1, "Kelas tidak diketahui"),
  semesterId: z.string().min(1, "Pilih semester"),
  entries: z.array(gradeEntrySchema).min(1, "Tidak ada nilai untuk disimpan"),
});

export type GradeBulkInput = z.infer<typeof gradeBulkSchema>;

/* ============================================================
 * FILTER
 * ============================================================ */

export const gradeViewSchema = z.object({
  classId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  subjectId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
});
