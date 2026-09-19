import { z } from "zod";
import {
  optionalText,
  optionalEmail,
  normalizePhone,
} from "./common";

/**
 * Validasi pendaftaran SPMB PUBLIK.
 *
 * Berbeda dari `lib/validations/site.ts` (perkakas panitia), berkas ini untuk
 * ORANG TUA yang mengisi formulir sendiri — tanpa akun, tanpa pelatihan.
 * Karena itu validasinya dirancang dengan aturan yang berbeda:
 *
 *   1. PESAN HARUS MENGAJARI, bukan menghakimi. "Nomor HP tidak valid" tidak
 *      berguna; "contoh: 081234567890" memberi tahu cara memperbaikinya.
 *   2. JANGAN menolak hal yang wajar. Orang tua boleh menulis nomor dengan
 *      spasi/tanda hubung, nama dengan gelar, alamat pendek. Semua dinormalkan
 *      di sini, bukan ditolak.
 *   3. GALAK pada hal yang benar-benar wajib. Ijazah & akta tidak bisa
 *      menyusul setelah seleksi; menolak di depan lebih baik daripada
 *      membatalkan pendaftaran nanti.
 */

/* ============================================================
 * BANTUAN
 * ============================================================ */

/** Nomor HP WAJIB, dinormalkan ke E.164 tanpa '+' (62812...). */
const requiredPhone = z
  .string()
  .trim()
  .min(1, "Nomor HP wajib diisi")
  .transform((v) => normalizePhone(v))
  .refine((v): v is string => typeof v === "string" && /^62\d{8,14}$/.test(v), {
    message: "Nomor HP tidak valid (contoh: 081234567890)",
  });

/** Tanggal lahir dari <input type="date"> (YYYY-MM-DD). */
const birthDateField = z
  .string()
  .trim()
  .min(1, "Tanggal lahir wajib diisi")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Tanggal lahir tidak valid")
  .refine((v) => {
    // Sekolah tidak menerima pendaftar yang lahir di masa depan.
    return new Date(v).getTime() <= Date.now();
  }, "Tanggal lahir tidak boleh di masa depan");

/* ============================================================
 * FORMULIR PENDAFTARAN
 * ============================================================ */

/**
 * Satu jalur pendaftaran yang dipilih pendaftar.
 *
 * `batchId` + `pathId` dikirim dari form dan WAJIB diverifikasi ulang di
 * server terhadap DB (jalur ini benar milik gelombang ini, gelombangnya masih
 * terbuka). Validasi Zod hanya memastikan bentuknya; kebenarannya dijaga oleh
 * Action — form bisa saja dimanipulasi.
 */
export const publicRegistrationSchema = z.object({
  batchId: z.string().trim().min(1, "Gelombang pendaftaran tidak dikenali"),
  pathId: z.string().trim().min(1, "Silakan pilih jalur pendaftaran"),

  // --- Calon murid ---
  fullName: z
    .string()
    .trim()
    .min(3, "Nama lengkap wajib diisi (minimal 3 huruf)")
    .max(120, "Nama terlalu panjang"),
  gender: z.enum(["MALE", "FEMALE"], {
    message: "Silakan pilih jenis kelamin",
  }),
  birthPlace: z.string().trim().min(1, "Tempat lahir wajib diisi").max(80),
  birthDate: birthDateField,
  religion: optionalText(40),
  address: z
    .string()
    .trim()
    .min(5, "Alamat wajib diisi lebih lengkap")
    .max(300),
  phone: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : normalizePhone(v)))
    .optional()
    .refine((v) => v === undefined || /^62\d{8,14}$/.test(v), {
      message: "Nomor HP tidak valid (contoh: 081234567890)",
    }),
  email: optionalEmail,
  previousSchool: optionalText(160),

  // --- Wali / orang tua ---
  parentName: z
    .string()
    .trim()
    .min(3, "Nama orang tua/wali wajib diisi")
    .max(120),
  parentPhone: requiredPhone,
  parentRelation: z.enum(["FATHER", "MOTHER", "GUARDIAN"], {
    message: "Silakan pilih hubungan dengan calon murid",
  }),

  // --- Persetujuan ---
  /**
   * Pendaftar WAJIB menyetujui syarat. Disimpan sebagai bukti bahwa syarat
   * sudah dibaca — sekolah sering diminta menunjukkan ini saat sengketa.
   */
  agree: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true)
    .refine((v) => v === true, "Anda harus menyetujui syarat pendaftaran"),
});

export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;

/* ============================================================
 * PENGECEKAN STATUS
 * ============================================================ */

/**
 * Kunci pengecekan status = nomor pendaftaran + nomor HP orang tua.
 *
 * Kenapa dua kunci, bukan satu nomor pendaftaran saja: nomor pendaftaran
 * relatif mudah ditebak (memuat tahun & jalur). Tanpa kunci kedua, siapa pun
 * bisa membaca data keluarga orang lain. Nomor HP orang tua adalah rahasia
 * yang hanya diketahui pendaftar.
 */
export const statusCheckSchema = z.object({
  registrationNo: z
    .string()
    .trim()
    .min(4, "Nomor pendaftaran wajib diisi")
    .max(60)
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  phone: requiredPhone,
});

export type StatusCheckInput = z.infer<typeof statusCheckSchema>;
