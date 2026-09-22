import { z } from "zod";
import { optionalText } from "./common";
import {
  allBlockKeys,
  allVariantKeys,
  BLOCK_DEFINITIONS,
  getBlock,
  variantBelongsToBlock,
} from "@/lib/site-blocks";
import {
  THEME_PRESETS,
  HEADING_FONTS,
  BODY_FONTS,
  CORNER_STYLES,
} from "@/lib/site-themes";

/**
 * Validasi web sekolah publik: blok halaman depan, halaman kustom, menu,
 * tema, dan pengaturan situs.
 */

/* ============================================================
 * BANTUAN
 * ============================================================ */

/** URL aman: hanya http(s), path internal (diawali "/"), atau kosong. */
const safeUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      v === "" ||
      v.startsWith("/") ||
      /^https?:\/\//i.test(v),
    "Gunakan tautan internal (diawali /) atau alamat http(s) yang lengkap.",
  );

/** URL gambar: wajib path internal atau http(s), boleh kosong. */
const imageUrl = safeUrl;

const slugSchema = z
  .string()
  .trim()
  .min(1, "Alamat halaman wajib diisi")
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Alamat hanya huruf kecil, angka, dan tanda hubung (mis. visi-misi)",
  );

const hexColor = z
  .string()
  .trim()
  .regex(/^#?[0-9A-Fa-f]{6}$/, "Warna harus format hex, mis. #1E40AF");

/**
 * Alamat halaman yang DIPAKAI fitur bawaan web sekolah.
 *
 * Sekolah tidak boleh membuat halaman dengan alamat ini: halaman kustom
 * bernama "spmb" akan menutupi formulir pendaftaran, dan "berita" menutupi
 * daftar berita. Daftar ini harus selaras dengan `RESERVED_SLUGS` di
 * `app/(public)/[pageSlug]/page.tsx`.
 */
export const RESERVED_PAGE_SLUGS = [
  "spmb",
  "berita",
  "agenda",
  "galeri",
  "kontak",
] as const;

/* ============================================================
 * BLOK HALAMAN DEPAN
 * ============================================================ */

export const blockKeySchema = z
  .string()
  .refine((k) => allBlockKeys().includes(k), "Jenis blok tidak dikenal");

/**
 * Simpan susunan blok halaman depan sekaligus (bukan satu per satu).
 *
 * Alasan: sekolah menyusun ulang urutan dengan menggeser; mengirim seluruh
 * susunan dalam satu permintaan mencegah urutan setengah jadi saat jaringan
 * terputus di tengah.
 */
export const saveLayoutSchema = z
  .object({
    blocks: z
      .array(
        z.object({
          blockKey: blockKeySchema,
          variantKey: z
            .string()
            .refine((v) => allVariantKeys().includes(v), "Gaya blok tidak dikenal"),
          order: z.coerce.number().int().min(0).max(100),
          isEnabled: z.union([z.literal("on"), z.boolean()]).optional(),
        }),
      )
      .min(1, "Minimal satu blok diperlukan"),
  })
  .superRefine((data, ctx) => {
    // Blok ganda tidak diizinkan di halaman depan.
    const seen = new Set<string>();
    data.blocks.forEach((b, i) => {
      if (seen.has(b.blockKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blocks", i, "blockKey"],
          message: `Blok "${getBlock(b.blockKey)?.name ?? b.blockKey}" tidak boleh muncul dua kali.`,
        });
      }
      seen.add(b.blockKey);

      if (!variantBelongsToBlock(b.blockKey, b.variantKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blocks", i, "variantKey"],
          message: `Gaya "${b.variantKey}" tidak tersedia untuk blok "${getBlock(b.blockKey)?.name ?? b.blockKey}".`,
        });
      }
    });
  });

export type SaveLayoutInput = z.infer<typeof saveLayoutSchema>;

/**
 * Simpan isi (props) satu blok.
 * Bentuk props berbeda per jenis blok, jadi divalidasi di server berdasarkan
 * blockKey. Di sini hanya bentuk baku: objek JSON.
 */
export const saveBlockPropsSchema = z.object({
  blockKey: blockKeySchema,
  props: z.string().trim().min(2, "Isi blok kosong"),
});

/** Skema khusus per blok — menjaga isi tetap sesuai rancangan. */

const statItem = z.object({
  label: z.string().trim().min(1).max(40),
  value: z.string().trim().min(1).max(20),
});

const faqItem = z.object({
  question: z.string().trim().min(1, "Pertanyaan wajib diisi").max(200),
  answer: z.string().trim().min(1, "Jawaban wajib diisi").max(2000),
});

const itemCount = z.coerce.number().int().min(1).max(40);

/**
 * Skema props untuk SETIAP blok.
 *
 * Diketik sebagai `z.ZodObject<z.ZodRawShape>` (bukan `ZodTypeAny`) agar
 * pemanggil — termasuk test dan action — tetap mendapat `.safeParse()` yang
 * terketik, bukan `unknown`.
 */
export const BLOCK_PROPS_SCHEMAS: Record<string, z.ZodObject<z.ZodRawShape>> = {
  hero: z.object({
    title: z.string().trim().max(120).default(""),
    subtitle: z.string().trim().max(300).default(""),
    imageUrl: imageUrl.default(""),
    ctaLabel: z.string().trim().max(40).default(""),
    ctaHref: safeUrl.default(""),
    cta2Label: z.string().trim().max(40).default(""),
    cta2Href: safeUrl.default(""),
  }),
  profile: z.object({
    heading: z.string().trim().max(120).default(""),
    body: z.string().trim().max(6000).default(""),
    imageUrl: imageUrl.default(""),
    imagePosition: z.enum(["kanan", "kiri", "bawah"]).default("kanan"),
  }),
  stats: z.object({
    heading: z.string().trim().max(120).default(""),
    items: z.array(statItem).max(4, "Maksimal 4 angka").default([]),
  }),
  news: z.object({
    heading: z.string().trim().max(120).default(""),
    // Nama field HARUS "subtitle" agar cocok dengan prop NewsBlock.
    // (Sebelumnya bernama "subheading" — editor menyimpan "subheading" tapi
    //  komponen membaca "subtitle", sehingga teksnya tidak pernah tampil.)
    subtitle: z.string().trim().max(200).default(""),
    itemCount: itemCount.default(3),
  }),
  agenda: z.object({
    heading: z.string().trim().max(120).default(""),
    itemCount: itemCount.default(4),
  }),
  gallery: z.object({
    heading: z.string().trim().max(120).default(""),
    itemCount: itemCount.default(6),
  }),
  teachers: z.object({
    heading: z.string().trim().max(120).default(""),
    itemCount: itemCount.default(6),
    showPosition: z.boolean().default(true),
  }),
  faq: z.object({
    heading: z.string().trim().max(120).default(""),
    items: z.array(faqItem).max(12, "Maksimal 12 pertanyaan").default([]),
  }),
  contact: z.object({
    heading: z.string().trim().max(120).default(""),
    showMap: z.boolean().default(true),
    showHours: z.boolean().default(true),
  }),
  spmb: z.object({
    title: z.string().trim().max(120).default(""),
    subtitle: z.string().trim().max(300).default(""),
  }),

  /* ============================================================
   * BLOK GENERAL (halaman kustom)
   *
   * Batas panjang di sini BUKAN hiasan: isi blok tampil di halaman publik
   * sekolah, dan tanpa batas satu operator bisa menempelkan dokumen sepanjang
   * apa pun ke satu blok — memperlambat halaman bagi semua pengunjung.
   * ============================================================ */
  richtext: z.object({
    heading: z.string().trim().max(160).default(""),
    // Isi dari editor teks kaya (HTML). Batas lebih longgar karena tag
    // menambah panjang, tetapi tetap dibatasi agar tidak tak terhingga.
    body: z.string().max(30000).default(""),
  }),

  section: z.object({
    heading: z.string().trim().max(160).default(""),
    subheading: z.string().trim().max(300).default(""),
  }),

  image: z.object({
    imageUrl: imageUrl.default(""),
    alt: z.string().trim().max(200).default(""),
    caption: z.string().trim().max(300).default(""),
  }),

  table: z.object({
    heading: z.string().trim().max(160).default(""),
    columns: z
      .array(z.object({ label: z.string().trim().max(60).default("") }))
      .max(5, "Maksimal 5 kolom agar tetap terbaca di ponsel")
      .default([]),
    rows: z
      .array(
        z.object({
          c0: z.string().trim().max(300).default(""),
          c1: z.string().trim().max(300).default(""),
          c2: z.string().trim().max(300).default(""),
          c3: z.string().trim().max(300).default(""),
          c4: z.string().trim().max(300).default(""),
        }),
      )
      .max(30, "Maksimal 30 baris")
      .default([]),
    footnote: z.string().trim().max(300).default(""),
  }),

  steps: z.object({
    heading: z.string().trim().max(160).default(""),
    items: z
      .array(
        z.object({
          title: z.string().trim().max(120).default(""),
          body: z.string().trim().max(600).default(""),
        }),
      )
      .max(12, "Maksimal 12 langkah")
      .default([]),
  }),

  timeline: z.object({
    heading: z.string().trim().max(160).default(""),
    items: z
      .array(
        z.object({
          year: z.string().trim().max(20).default(""),
          title: z.string().trim().max(160).default(""),
          body: z.string().trim().max(600).default(""),
        }),
      )
      .max(20, "Maksimal 20 peristiwa")
      .default([]),
  }),

  cards: z.object({
    heading: z.string().trim().max(160).default(""),
    items: z
      .array(
        z.object({
          title: z.string().trim().max(120).default(""),
          body: z.string().trim().max(600).default(""),
          imageUrl: imageUrl.default(""),
          value: z.string().trim().max(20).default(""),
        }),
      )
      .max(12, "Maksimal 12 kartu")
      .default([]),
  }),

  downloads: z.object({
    heading: z.string().trim().max(160).default(""),
    items: z
      .array(
        z.object({
          title: z.string().trim().max(160).default(""),
          url: safeUrl.default(""),
          note: z.string().trim().max(200).default(""),
          size: z.string().trim().max(20).default(""),
        }),
      )
      .max(20, "Maksimal 20 berkas")
      .default([]),
  }),

  achievements: z.object({
    heading: z.string().trim().max(160).default(""),
    items: z
      .array(
        z.object({
          year: z.string().trim().max(20).default(""),
          title: z.string().trim().max(200).default(""),
          winner: z.string().trim().max(120).default(""),
          level: z.string().trim().max(60).default(""),
        }),
      )
      .max(30, "Maksimal 30 prestasi")
      .default([]),
  }),

  quote: z.object({
    quote: z.string().trim().max(1000).default(""),
    attribution: z.string().trim().max(120).default(""),
    role: z.string().trim().max(120).default(""),
    photoUrl: imageUrl.default(""),
  }),

  video: z.object({
    heading: z.string().trim().max(160).default(""),
    youtubeUrl: safeUrl.default(""),
    caption: z.string().trim().max(300).default(""),
  }),

  divider: z.object({
    label: z.string().trim().max(80).default(""),
  }),
};

/** Semua kunci blok harus punya skema props (dijaga oleh test). */
export const BLOCK_PROPS_KEYS = Object.keys(BLOCK_PROPS_SCHEMAS);

/* ============================================================
 * HALAMAN KUSTOM
 * ============================================================ */

export const pageCreateSchema = z.object({
  title: z.string().trim().min(1, "Judul halaman wajib diisi").max(120),
  slug: slugSchema,
  content: z.string().max(60000).default(""),
  showInNav: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
  isPublished: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
  metaTitle: optionalText(120),
  metaDescription: optionalText(300),
});

export const pageUpdateSchema = pageCreateSchema.extend({
  id: z.string().min(1),
});

/* ============================================================
 * MENU NAVIGASI
 * ============================================================ */

export const navigationCreateSchema = z.object({
  label: z.string().trim().min(1, "Nama menu wajib diisi").max(40),
  href: safeUrl.refine((v) => v.length > 0, "Tujuan menu wajib diisi"),
  area: z.enum(["header", "footer"]).default("header"),
  order: z.coerce.number().int().min(0).max(50).default(0),
  isExternal: z
    .union([z.literal("on"), z.literal(""), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
  onlyIfSpmb: z
    .union([z.literal("on"), z.literal(""), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
});

export const navigationUpdateSchema = navigationCreateSchema.extend({
  id: z.string().min(1),
});

/** Susun ulang urutan menu sekaligus. */
export const reorderSchema = z.object({
  area: z.enum(["header", "footer"]),
  ids: z.array(z.string().min(1)).min(1),
  orders: z.array(z.coerce.number().int().min(0)).min(1),
});

/* ============================================================
 * TEMA & PENGATURAN SITUS
 * ============================================================ */

export const themeSchema = z.object({
  preset: z
    .string()
    .refine((p) => THEME_PRESETS.some((t) => t.key === p), "Tema tidak dikenal"),
  primaryColor: z.union([hexColor, z.literal("")]).optional(),
  accentColor: z.union([hexColor, z.literal("")]).optional(),
  headingFont: z
    .string()
    .refine((f) => HEADING_FONTS.some((x) => x.key === f), "Pilihan huruf judul tidak dikenal")
    .default("fraunces"),
  bodyFont: z
    .string()
    .refine((f) => BODY_FONTS.some((x) => x.key === f), "Pilihan huruf isi tidak dikenal")
    .default("public-sans"),
  cornerStyle: z
    .string()
    .refine((c) => CORNER_STYLES.some((x) => x.key === c), "Gaya sudut tidak dikenal")
    .default("lembut"),
});

export const siteConfigSchema = z.object({
  tagline: optionalText(120),
  shortDescription: optionalText(400),
  homepageMode: z.enum(["BLOCKS", "SINGLE"]).default("BLOCKS"),
  beritaUrl: z.union([safeUrl, z.literal("")]).optional(),
  contactWa: optionalText(20),
  facebookUrl: z.union([safeUrl, z.literal("")]).optional(),
  instagramUrl: z.union([safeUrl, z.literal("")]).optional(),
  youtubeUrl: z.union([safeUrl, z.literal("")]).optional(),
  tiktokUrl: z.union([safeUrl, z.literal("")]).optional(),
  mapsUrl: z.union([safeUrl, z.literal("")]).optional(),
  officeHours: optionalText(200),
});

/** Pilihan susunan awal (satu klik untuk sekolah baru). */
export const applyPresetLayoutSchema = z.object({
  preset: z.enum(["DEFAULT", "ACADEMIC"]),
});

/* ============================================================
 * SPMB — JALUR PENDAFTARAN
 * ============================================================ */

export const admissionPathCreateSchema = z.object({
  batchId: z.string().min(1, "Gelombang wajib dipilih"),
  name: z.string().trim().min(1, "Nama jalur wajib diisi").max(60),
  code: z
    .string()
    .trim()
    .min(2, "Kode jalur terlalu pendek")
    .max(20)
    // Ubah ke huruf kapital LEBIH DULU, baru periksa bentuknya. Kalau urutannya
    // terbalik, "prestasi" akan ditolak padahal sekolah wajar menulis begitu.
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9]+$/.test(v), "Kode jalur hanya huruf dan angka"),
  description: optionalText(300),
  quota: z.coerce.number().int().min(0, "Kuota tidak boleh negatif").max(10_000),
  /**
   * Biaya pendaftaran OPSIONAL dan dalam rupiah bulat.
   * Kosong = tidak dipungut biaya (bukan 0 yang ambigu).
   */
  registrationFee: z
    .union([
      z.literal(""),
      z.coerce
        .number()
        .int("Biaya harus bilangan bulat rupiah")
        .min(0, "Biaya tidak boleh negatif")
        .max(100_000_000, "Biaya terlalu besar"),
    ])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  requirements: optionalText(2000),
  order: z.coerce.number().int().min(0).max(50).default(0),
  isActive: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
});

export const admissionPathUpdateSchema = admissionPathCreateSchema.extend({
  id: z.string().min(1),
});

/** Hapus jalur terakhir perlu dicegah — sekolah harus punya minimal satu. */
export const admissionPathDeleteSchema = z.object({
  id: z.string().min(1),
});

/**
 * Tinjauan satu pendaftaran oleh panitia (terima / tolak / tunggu).
 *
 * `reRegistrationFee` hanya dipakai saat status DITERIMA — nominal daftar ulang
 * disimpan pada pendaftaran supaya bisa dipakai ketika panitia membuatkan akun
 * siswa (Invoice wajib terhubung ke Student, jadi belum bisa dibuat lebih awal).
 */
export const registrationReviewSchema = z.object({
  id: z.string().min(1, "Pendaftaran tidak dikenal"),
  // Nilai HARUS sama persis dengan enum RegistrationStatus di schema.prisma.
  status: z.enum([
    "PENDING",
    "VERIFIED",
    "TESTED",
    "ACCEPTED",
    "REJECTED",
    "WAITLIST",
    "WITHDRAWN",
  ]),
  note: z.string().trim().max(500).default(""),
  /**
   * Nilai seleksi. Kolomnya sudah ada di database sejak awal tetapi tidak
   * pernah bisa diisi dari mana pun — seleksi berbasis nilai tidak bisa
   * dicatat. Opsional: banyak sekolah menerima tanpa tes.
   */
  score: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(1000)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  reRegistrationFee: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
});

/* ============================================================
 * SPMB — GELOMBANG
 * ============================================================ */

/**
 * Bentuk dasar gelombang TANPA refine — supaya bisa di-`extend()`.
 * (.refine() mengubah ZodObject menjadi ZodEffects yang tidak punya .extend())
 *
 * Tanggal dari `<input type="date">` datang sebagai "YYYY-MM-DD" — BUKAN
 * ISO-8601 lengkap. Prisma menolaknya dengan "premature end of input", jadi
 * nilainya diubah menjadi `Date` di sini, di satu tempat.
 *
 * Pola ini sama dengan `dateString` di validations/academic.ts. Menyimpan
 * `z.string()` lalu mengubahnya di dalam action berarti setiap pemanggil baru
 * harus ingat melakukannya — dan satu yang lupa akan gagal saat disimpan,
 * bukan saat divalidasi.
 */
const batchDate = z
  .string()
  .trim()
  .min(1, "Tanggal wajib diisi")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Tanggal tidak valid");

const admissionBatchBase = z.object({
  academicYearId: z.string().min(1, "Tahun ajaran wajib dipilih"),
  name: z.string().trim().min(1, "Nama gelombang wajib diisi").max(80),
  openDate: batchDate,
  closeDate: batchDate,
  quota: z.coerce.number().int().min(0).max(100_000),
  description: optionalText(3000),
  requirements: optionalText(6000),
  isActive: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    // Bawaannya AKTIF. Sebelumnya `v === "on" || v === true` menghasilkan
    // `false` ketika field tidak dikirim sama sekali — dan form "Buat
    // gelombang" memang tidak punya kotak centangnya. Akibatnya setiap
    // gelombang baru selalu lahir nonaktif, dan pendaftaran tidak pernah
    // terbuka walau tanggalnya sudah benar.
    //
    // `undefined` sengaja dibedakan dari `false`: "tidak disebut" berarti pakai
    // bawaan, sedangkan "dinyatakan tidak aktif" harus tetap dihormati.
    .transform((v) => (v === undefined ? undefined : v === "on" || v === true)),
});

/** Tanggal tutup harus setelah tanggal buka. */
const checkBatchDates = (d: { openDate: Date; closeDate: Date }) =>
  d.closeDate.getTime() > d.openDate.getTime();

export const admissionBatchCreateSchema = admissionBatchBase.refine(checkBatchDates, {
  message: "Tanggal tutup harus setelah tanggal buka",
  path: ["closeDate"],
});

/**
 * Perbarui gelombang — BERSIFAT PARSIAL.
 *
 * ============================================================
 * KENAPA TIDAK MEWAJIBKAN SEMUA KOLOM
 * ============================================================
 * Form "Ubah gelombang" di dasbor adalah suntingan cepat: hanya nama, kuota,
 * dan status aktif. Tanggal tidak ada di sana karena mengubah periode
 * pendaftaran di tengah gelombang yang sedang berjalan adalah keputusan besar
 * yang pantas dilakukan lewat alur tersendiri, bukan sambil menyunting nama.
 *
 * Sebelumnya skema ini mewarisi kewajiban `openDate`/`closeDate` dari bentuk
 * dasarnya, sehingga SETIAP penyimpanan dari form itu gagal dengan
 * "Periksa kembali isian." — padahal yang diisi operator sudah benar.
 *
 * Konsistensi tanggal (tutup harus setelah buka) tetap diperiksa, tetapi di
 * AKSI, terhadap nilai gabungan (tersimpan + yang baru). Di skema tidak bisa:
 * saat salah satu tanggal tidak dikirim, tidak ada yang bisa dibandingkan.
 */
export const admissionBatchUpdateSchema = admissionBatchBase
  .partial()
  .extend({ id: z.string().min(1) });

/** Pengumuman hasil seleksi. */
export const admissionResultSchema = z.object({
  batchId: z.string().min(1),
  resultAnnouncement: z.string().trim().max(6000).default(""),
  resultDate: z.union([z.string(), z.literal("")]).optional(),
  /** Kirim notifikasi WA ke semua pendaftar? */
  notify: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
});

/* ============================================================
 * BERITA / HALAMAN KONTEN PUBLIK
 * ============================================================ */

export const POST_TYPES = ["NEWS", "ANNOUNCEMENT", "AGENDA", "GALLERY"] as const;
export type PostTypeValue = (typeof POST_TYPES)[number];

export const POST_TYPE_LABEL: Record<PostTypeValue, string> = {
  NEWS: "Berita",
  ANNOUNCEMENT: "Pengumuman",
  AGENDA: "Agenda",
  GALLERY: "Galeri",
};

export const postCreateSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi").max(160),
  slug: slugSchema,
  excerpt: optionalText(300),
  content: z.string().max(100_000).default(""),
  coverUrl: imageUrl.default(""),
  type: z.enum(POST_TYPES).default("NEWS"),
  isPublished: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
  /** Jadwal terbit (opsional). Kosong = terbit sekarang bila diaktifkan. */
  publishedAt: z.union([z.string(), z.literal("")]).optional(),
  /** Khusus agenda: kapan kegiatan berlangsung. */
  eventDate: z.union([z.string(), z.literal("")]).optional(),
  eventLocation: optionalText(200),
});

export const postUpdateSchema = postCreateSchema.extend({
  id: z.string().min(1),
});
