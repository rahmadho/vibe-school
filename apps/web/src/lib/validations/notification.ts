import { z } from "zod";
import { optionalText } from "./common";

/**
 * Validasi Notifikasi: template pesan, pengumuman, kirim ulang, impor bawaan.
 */

export const TEMPLATE_CATEGORIES = [
  "ATTENDANCE",
  "GRADE",
  "FINANCE",
  "ANNOUNCEMENT",
  "ADMISSION",
  "GENERAL",
] as const;
export type TemplateCategoryValue = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategoryValue, string> = {
  ATTENDANCE: "Absensi",
  GRADE: "Penilaian",
  FINANCE: "Keuangan",
  ANNOUNCEMENT: "Pengumuman",
  ADMISSION: "SPMB",
  GENERAL: "Umum",
};

export const templateCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Kunci wajib diisi")
    .max(60)
    .regex(/^[a-z0-9_.]+$/, "Kunci hanya huruf kecil, angka, titik dan _"),
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  category: z.enum(TEMPLATE_CATEGORIES),
  body: z
    .string()
    .trim()
    .min(5, "Isi pesan terlalu pendek")
    .max(4096, "Isi pesan melebihi batas WhatsApp (4096 karakter)"),
  description: optionalText(200),
  isActive: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
});

export const templateUpdateSchema = templateCreateSchema.extend({
  id: z.string().min(1),
});

/** Uji coba kirim pesan (pratinjau nyata ke satu nomor). */
export const testSendSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(8, "Nomor terlalu pendek")
    .max(20)
    .regex(/^[\d+\s\-().]+$/, "Nomor mengandung karakter tidak sah"),
  body: z.string().trim().min(1, "Isi pesan kosong").max(4096, "Pesan terlalu panjang"),
});

/* ============================================================
 * PENGUMUMAN MASSAL
 * ============================================================ */

export const AUDIENCE_TYPES = [
  "PARENTS_OF_CLASS",
  "STUDENTS_OF_CLASS",
  "PARENTS_OF_SCHOOL",
  "TEACHERS",
] as const;
export type AudienceTypeValue = (typeof AUDIENCE_TYPES)[number];

export const AUDIENCE_LABEL: Record<AudienceTypeValue, string> = {
  PARENTS_OF_CLASS: "Orang tua/wali satu kelas",
  STUDENTS_OF_CLASS: "Siswa satu kelas",
  PARENTS_OF_SCHOOL: "Seluruh orang tua/wali sekolah",
  TEACHERS: "Seluruh guru & staf",
};

export const announcementSchema = z
  .object({
    title: z.string().trim().min(1, "Judul wajib diisi").max(120),
    body: z.string().trim().min(5, "Isi pesan terlalu pendek").max(4096),
    audienceType: z.enum(AUDIENCE_TYPES),
    audienceClassId: optionalText(60),
  })
  .refine(
    (d) =>
      d.audienceType !== "PARENTS_OF_CLASS" &&
      d.audienceType !== "STUDENTS_OF_CLASS"
        ? true
        : Boolean(d.audienceClassId),
    { message: "Pilih kelas untuk audiens ini", path: ["audienceClassId"] },
  );

export type AnnouncementInput = z.infer<typeof announcementSchema>;

/** Batalkan pesan yang belum terkirim (hanya yang masih antre). */
export const cancelSchema = z.object({
  id: z.string().min(1),
});

/** Impor template bawaan untuk sekolah ini. */
export const importSeedSchema = z.object({
  keys: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return [] as string[];
      return Array.isArray(v) ? v : [v];
    }),
  overwrite: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
});
