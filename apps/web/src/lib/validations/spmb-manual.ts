import { z } from "zod";
import { optionalEmail, optionalPhone } from "@/lib/validations/common";

/**
 * Skema pendaftaran MANUAL (walk-in / telepon).
 *
 * ============================================================
 * KENAPA SKEMANYA TERPISAH DARI PENDAFTARAN PUBLIK
 * ============================================================
 * Dua hal berbeda yang tidak boleh disatukan:
 *
 *   1. PUBLIK — orang tua mengetik sendiri, tanpa pengawasan. Karena itu
 *      validasinya ketat dan banyak yang wajib, dan statusnya selalu PENDING
 *      (belum ada yang memeriksa berkasnya).
 *
 *   2. MANUAL — panitia mengetik sambil melihat orang tua dan berkas fisiknya.
 *      Berkas sudah diperiksa di depan mata, jadi statusnya boleh langsung
 *      VERIFIED. Panitia juga sering hanya mencatat yang penting dulu
 *      (nama, orang tua, kontak) dan melengkapi sisanya belakangan — memaksa
 *      semua kolom wajib justru membuat panitia mengetik asal-asalan agar
 *      bisa lanjut.
 *
 * Karena itu `birthPlace`, `religion`, dan `address` opsional di sini.
 */

export const REGISTRATION_SOURCES = ["WALK_IN", "PHONE"] as const;
export type RegistrationSourceValue = (typeof REGISTRATION_SOURCES)[number];

export const REGISTRATION_SOURCE_LABEL: Record<string, string> = {
  PUBLIC: "Online",
  WALK_IN: "Datang langsung",
  PHONE: "Telepon / WA",
};

export const manualRegistrationSchema = z.object({
  batchId: z.string().min(1, "Gelombang wajib dipilih"),
  pathId: z.string().min(1, "Jalur wajib dipilih"),
  majorId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),

  /**
   * Nomor pendaftaran boleh diisi panitia.
   *
   * Sekolah sering punya buku register fisik yang nomornya sudah berjalan
   * sebelum sistem ini dipakai. Memaksa nomor buatan sistem membuat dua
   * penomoran yang tidak sinkron. Kosong = dibuat otomatis.
   */
  registrationNo: z.string().trim().max(40).optional().default(""),

  source: z.enum(REGISTRATION_SOURCES, {
    message: "Sumber pendaftaran tidak dikenal",
  }),

  /** Langsung VERIFIED: berkas sudah dilihat panitia saat mendaftar. */
  markVerified: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),

  fullName: z.string().trim().min(2, "Nama lengkap wajib diisi").max(120),
  gender: z.enum(["MALE", "FEMALE"], { message: "Jenis kelamin wajib dipilih" }),
  birthPlace: z.string().trim().max(80).optional().default(""),
  birthDate: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((v) => (v === "" ? undefined : new Date(v)))
    .refine((d) => d === undefined || !Number.isNaN(d.getTime()), "Tanggal lahir tidak valid"),
  religion: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().max(400).optional().default(""),
  phone: optionalPhone,
  email: optionalEmail,
  previousSchool: z.string().trim().max(160).optional().default(""),

  parentName: z.string().trim().min(2, "Nama orang tua/wali wajib diisi").max(120),
  // Nomor WA orang tua WAJIB: inilah kunci yang dipakai orang tua untuk
  // mengecek status, dan alamat notifikasi hasil seleksi.
  parentPhone: optionalPhone.refine(
    (v) => v !== undefined,
    "Nomor WA orang tua/wali wajib diisi",
  ),
  parentRelation: z.enum(["FATHER", "MOTHER", "GUARDIAN"], {
    message: "Hubungan wali wajib dipilih",
  }),

  /**
   * Kirim notifikasi WA ke orang tua?
   *
   * Default TIDAK menyala untuk pendaftar walk-in: orang tuanya biasanya masih
   * berdiri di depan panitia, dan mengirim pesan ke orang yang ada di ruangan
   * yang sama terasa janggal. Untuk pendaftaran lewat telepon, justru WA yang
   * menjadi bukti tercatat — karena itu panitia yang memutuskan.
   */
  notify: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),

  note: z.string().trim().max(500).optional().default(""),
});

export type ManualRegistrationInput = z.infer<typeof manualRegistrationSchema>;
