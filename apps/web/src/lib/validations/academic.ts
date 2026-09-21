import { z } from "zod";
import {
  optionalId,
  academicYearName,
  optionalText,
  optionalPhone,
} from "./common";

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
    // 60 karakter, bukan 20: SMK menamai kelas dengan jurusan lengkap, mis.
    // "XII Teknik Komputer dan Jaringan 1" (33 karakter) yang dulu DITOLAK.
    .max(60, "Nama kelas maksimal 60 karakter"),
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
  /** Jurusan/peminatan kelas. Kosong = kelas umum (perilaku lama). */
  majorId: optionalId,
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

/** Kelompok mapel — dipakai untuk pengelompokan rapor & penyaringan. */
export const SUBJECT_GROUPS = ["UMUM", "PEMINATAN", "KEJURUAN", "MUATAN_LOKAL"] as const;
export type SubjectGroupValue = (typeof SUBJECT_GROUPS)[number];

export const SUBJECT_GROUP_LABEL: Record<SubjectGroupValue, string> = {
  UMUM: "Umum (wajib semua siswa)",
  PEMINATAN: "Peminatan / pilihan",
  KEJURUAN: "Kejuruan / produktif",
  MUATAN_LOKAL: "Muatan lokal",
};

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
  /** Kelompok mapel untuk pengelompokan rapor. Default UMUM. */
  group: z.enum(SUBJECT_GROUPS).default("UMUM"),
  /** Jurusan pemilik mapel (khusus mapel peminatan/kejuruan). */
  majorId: optionalId,
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

/* ============================================================
 * JURUSAN / PEMINATAN
 * ============================================================ */
export const majorCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Kode wajib diisi")
    .max(20, "Kode maksimal 20 karakter")
    .transform((v) => v.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(120, "Nama maksimal 120 karakter"),
  description: optionalText(300),
  headTeacherId: optionalId,
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
});

export const majorUpdateSchema = majorCreateSchema.extend({
  id: z.string().min(1),
});

export const majorFilterSchema = z.object({
  q: z.string().trim().optional(),
  active: z.enum(["1", "0"]).optional(),
});

export type MajorInput = z.infer<typeof majorCreateSchema>;

/* ============================================================
 * PKL / PRAKERIN (SMK/MAK)
 * ============================================================ */
export const INTERNSHIP_STATUSES = ["PLANNED", "ONGOING", "COMPLETED", "CANCELLED"] as const;
export type InternshipStatusValue = (typeof INTERNSHIP_STATUSES)[number];

export const INTERNSHIP_STATUS_LABEL: Record<InternshipStatusValue, string> = {
  PLANNED: "Direncanakan",
  ONGOING: "Berjalan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

const dateOnly = z
  .string()
  .trim()
  .min(1, "Tanggal wajib diisi")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Tanggal tidak valid");

export const internshipCreateSchema = z
  .object({
    studentId: z.string().min(1, "Siswa wajib dipilih"),
    academicYearId: z.string().min(1, "Tahun ajaran wajib dipilih"),
    teacherId: optionalId,
    industryName: z
      .string()
      .trim()
      .min(2, "Nama industri minimal 2 karakter")
      .max(160, "Nama industri maksimal 160 karakter"),
    industryAddress: optionalText(300),
    industryPhone: optionalPhone,
    supervisorName: optionalText(120),
    supervisorPhone: optionalPhone,
    startDate: dateOnly,
    endDate: dateOnly,
    status: z.enum(INTERNSHIP_STATUSES).default("PLANNED"),
    // Nilai kosong harus tetap `undefined`, bukan 0. `z.coerce.number()`
    // mengubah "" menjadi 0 SEBELUM cabang `z.literal("")` diperiksa, sehingga
    // PKL yang belum dinilai tercatat bernilai 0 — dan rapor seolah siswa
    // mendapat nol. Pra-proses menutup celah itu.
    score: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce.number().int().min(0).max(100).optional(),
    ),
    certificateNo: optionalText(80),
    note: optionalText(300),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai",
    path: ["endDate"],
  });

export const internshipUpdateSchema = internshipCreateSchema;

export const internshipFilterSchema = z.object({
  academicYearId: z.string().trim().optional(),
  majorId: z.string().trim().optional(),
  status: z.string().trim().optional(),
  q: z.string().trim().optional(),
});

export type InternshipInput = z.infer<typeof internshipCreateSchema>;

/* ============================================================
 * UKK — UJI KOMPETENSI KEAHLIAN (SMK/MAK)
 * ============================================================ */
export const COMPETENCY_RESULTS = ["COMPETENT", "NOT_COMPETENT"] as const;
export type CompetencyResultValue = (typeof COMPETENCY_RESULTS)[number];

export const COMPETENCY_RESULT_LABEL: Record<CompetencyResultValue, string> = {
  COMPETENT: "Kompeten",
  NOT_COMPETENT: "Belum kompeten",
};

export const competencyTestCreateSchema = z.object({
  studentId: z.string().min(1, "Siswa wajib dipilih"),
  academicYearId: z.string().min(1, "Tahun ajaran wajib dipilih"),
  majorId: z.string().min(1, "Jurusan wajib dipilih"),
  examinerName: z
    .string()
    .trim()
    .min(2, "Nama penguji minimal 2 karakter")
    .max(160, "Nama penguji maksimal 160 karakter"),
  examinerOrg: optionalText(160),
  testDate: dateOnly,
  result: z.enum(COMPETENCY_RESULTS, { message: "Hasil UKK wajib dipilih" }),
  // Sama seperti PKL: nilai kosong harus `undefined`, bukan 0.
  score: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(0).max(100).optional(),
  ),
  certificateNo: optionalText(80),
  note: optionalText(300),
});

export const competencyTestUpdateSchema = competencyTestCreateSchema.extend({
  id: z.string().min(1),
});

export const competencyTestFilterSchema = z.object({
  academicYearId: z.string().trim().optional(),
  majorId: z.string().trim().optional(),
  result: z.string().trim().optional(),
  q: z.string().trim().optional(),
});

export type CompetencyTestInput = z.infer<typeof competencyTestCreateSchema>;
