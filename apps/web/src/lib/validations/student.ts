import { z } from "zod";
import {
  normalizePhone,
  optionalText,
  optionalPhone,
  optionalId,
} from "./common";
import {
  periksaKartuKeluarga,
  periksaKodeWilayah,
  periksaNIK,
} from "@/lib/nik-murni";

export { normalizePhone };

/**
 * Angka opsional dari input teks.
 *
 * PENTING — jangan pakai `z.coerce.number().optional()` langsung:
 * `Number("")` adalah 0, jadi kolom kosong tersimpan sebagai 0. Untuk jarak,
 * "0 km" terlihat seperti data nyata ("rumahnya di sebelah sekolah") padahal
 * operator hanya belum mengisi. Untuk penghasilan, 0 berarti "tidak
 * berpenghasilan" — kesimpulan yang salah dan berdampak ke bantuan siswa.
 *
 * Karena itu string kosong dikembalikan sebagai `undefined` LEBIH DULU,
 * sebelum coerce sempat menyentuhnya.
 */
function angkaOpsional(
  z: typeof import("zod").z,
  min: number,
  max: number,
  pesanMin: string,
  pesanMax: string,
) {
  return z
    .union([
      z.literal("").transform(() => undefined),
      z.coerce.number().int().min(min, pesanMin).max(max, pesanMax),
    ])
    .optional();
}

/**
 * Enum opsional yang menerima "" dari form.
 *
 * Form HTML selalu mengirim SEMUA field, dan `<select>` tanpa pilihan
 * mengirim "" — bukan menghilangkan field. `z.enum` menolak "", sehingga
 * satu dropdown kosong bisa menggagalkan seluruh form. Helper ini
 * menerjemahkan "" → undefined.
 *
 * Tipe dikembalikan sebagai `z.ZodType<T | undefined>` (bukan hasil inferensi
 * dari union) supaya nilai literalnya TIDAK melebar jadi `string` — kalau
 * melebar, hasil parse tidak bisa disimpan ke kolom enum Prisma.
 */
function enumOpsional<T extends string>(
  nilai: readonly [T, ...T[]],
): z.ZodType<T | undefined, z.ZodTypeDef, string | undefined> {
  // Opsi "" ditangani di DEPAN, lalu hasilnya DIKUNCI tipenya.
  //
  // Menangani "" lewat `z.union` membuat TypeScript melebarkan literalnya
  // jadi `string`. Tetapi sekadar `as` juga tidak cukup: `z.preprocess` dan
  // `z.union` menghasilkan ZodType yang tipe INPUT-nya longgar, dan tipe
  // input itulah yang menentukan tipe `parse()` — sehingga keluarnya `string`
  // walau sudah di-cast. Karena itu tipe input ditulis eksplisit sebagai
  // `string | undefined` (bentuk mentah dari form) dan output sebagai `T`.
  return z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.enum(nilai).optional(),
  ) as unknown as z.ZodType<T | undefined, z.ZodTypeDef, string | undefined>;
}

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

  /* ---------- Data administrasi (Dapodik/Disdik) ---------- */

  /**
   * NIK: 16 digit. Divalidasi lebih dari sekadar panjang — NIK menyandikan
   * tanggal lahir & jenis kelamin, jadi salah ketik bisa ditangkap sekarang.
   * Kolom ini OPSIONAL supaya input siswa lama tetap bisa disimpan.
   */
  nik: optionalText(20).superRefine((v, ctx) => {
    if (!v) return;
    const hasil = periksaNIK(v);
    if (!hasil.valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: hasil.alasan });
    }
  }),
  kkNumber: optionalText(20).superRefine((v, ctx) => {
    if (!v) return;
    const hasil = periksaKartuKeluarga(v);
    if (!hasil.valid && hasil.alasan) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: hasil.alasan });
    }
  }),

  // Alamat berjenjang — Dapodik & Disdik menolak alamat satu baris.
  village: optionalText(80),
  district: optionalText(80),
  city: optionalText(80),
  province: optionalText(80),
  postalCode: optionalText(10),
  villageCode: optionalText(20).superRefine((v, ctx) => {
    if (!v) return;
    const hasil = periksaKodeWilayah(v);
    if (!hasil.valid && hasil.alasan) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: hasil.alasan });
    }
  }),

  // Tempat tinggal & perjalanan. Kosong → undefined (bukan ""), karena
  // z.enum menolak "" dan form selalu mengirim semua field.
  residenceType: enumOpsional([
    "BERSAMA_ORANG_TUA",
    "BERSAMA_WALI",
    "KOST",
    "ASRAMA",
    "PANTI_ASUH",
    "LAINNYA",
  ]),
  transportation: enumOpsional([
    "JALAN_KAKI",
    "SEPEDA",
    "SEPEDA_MOTOR",
    "MOBIL_PRIBADI",
    "ANTAR_JEMPUT",
    "ANGKUTAN_UMUM",
    "OJEK_ONLINE",
    "PERAHU",
    "LAINNYA",
  ]),
  livingWith: enumOpsional(["ORANG_TUA", "WALI", "SENDIRI", "LAINNYA"]),
  distanceKm: angkaOpsional(
    z,
    0,
    500,
    "Jarak tidak boleh negatif",
    "Jarak tidak wajar (maks 500 km)",
  ),

  // Kesehatan
  bloodType: enumOpsional(["A", "B", "AB", "O"]),
  heightCm: angkaOpsional(
    z,
    50,
    250,
    "Tinggi tidak wajar",
    "Tinggi tidak wajar",
  ),
  weightKg: angkaOpsional(
    z,
    10,
    300,
    "Berat tidak wajar",
    "Berat tidak wajar",
  ),

  // Kesejahteraan. Checkbox tidak tercentang mengirim "" → false.
  isKipRecipient: z
    .union([z.literal(""), z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),

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
  // Data administrasi orang tua (Dapodik).
  parentNik: optionalText(20).superRefine((v, ctx) => {
    if (!v) return;
    const hasil = periksaNIK(v);
    if (!hasil.valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: hasil.alasan });
    }
  }),
  parentKkNumber: optionalText(20).superRefine((v, ctx) => {
    if (!v) return;
    const hasil = periksaKartuKeluarga(v);
    if (!hasil.valid && hasil.alasan) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: hasil.alasan });
    }
  }),
  parentOccupation: optionalText(80),
  parentEducation: enumOpsional([
    "TIDAK_SEKOLAH",
    "SD",
    "SMP",
    "SMA_SMK",
    "D1_D3",
    "D4_S1",
    "S2",
    "S3",
  ]),
  parentIncomeRange: enumOpsional([
    "TIDAK_BERPERGHASILAN",
    "KURANG_1_JUTA",
    "JUTA_1_2",
    "JUTA_2_5",
    "JUTA_5_10",
    "LEBIH_10_JUTA",
  ]),
  parentBirthYear: angkaOpsional(
    z,
    1930,
    new Date().getFullYear(),
    "Tahun lahir orang tua tidak wajar",
    "Tahun lahir orang tua tidak wajar",
  ),
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
