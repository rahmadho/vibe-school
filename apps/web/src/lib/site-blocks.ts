/**
 * Katalog blok tampilan web sekolah — MURNI (tanpa DB), sehingga dapat diuji.
 *
 * FILOSOFI (keputusan produk #2 dari user): "Kurasi + Gaya".
 *
 * Sekolah TIDAK menyusun halaman dari blok kecil bebas. Sekolah memilih dari
 * daftar blok yang sudah dirancang, lalu:
 *   1. mengatur URUTAN,
 *   2. menyalakan/mematikan,
 *   3. memilih VARIAN GAYA tiap blok (mis. berita: kartu/daftar/korsel),
 *   4. mengisi teks & gambar.
 *
 * Alasan: memberi kebebasan penuh berarti ada sekolah yang halaman depannya
 * berantakan — dan itu merusak nama produk kita. Kurasi menjaga mutu;
 * varian menjaga agar tiap sekolah tetap terasa "milik sendiri".
 *
 * SEMUA blok di sini WAJIB punya minimal 1 varian. Varian didefinisikan di
 * sini (bukan di komponen) supaya editor web dan renderer memakai sumber
 * kebenaran yang sama.
 */

import { GENERAL_BLOCK_DEFINITIONS } from "./site-blocks-general";

/* ============================================================
 * TIPE
 * ============================================================ */

export type BlockRequirement =
  | "none" // tidak butuh data apa pun (isi manual)
  | "posts" // berita/agenda dari tabel Post
  | "gallery" // foto dari Post bertipe GALLERY
  | "teachers" // data guru dari tabel Teacher
  | "spmb" // jalur SPMB aktif
  | "contact"; // info kontak dari SiteConfig

export type BlockVariant = {
  /** Kunci varian, unik secara global: "<block>.<gaya>". */
  key: string;
  /** Nama untuk admin. */
  label: string;
  /** Kapan varian ini sebaiknya dipakai. */
  hint: string;
  /**
   * Batas jumlah item yang masuk akal untuk varian ini.
   * Dipakai UI untuk membatasi input (mis. korsel maks 6 agar tidak berat).
   */
  maxItems?: number;
};

export type BlockDefinition = {
  /** Kunci blok, dipakai di SiteBlock.blockKey. */
  key: string;
  name: string;
  /** Satu baris penjelasan untuk admin. */
  description: string;
  /** Nama ikon — digambar sebagai SVG oleh UI, bukan emoji. */
  icon: string;
  requirement: BlockRequirement;
  /** Varian gaya yang tersedia. Minimal satu. */
  variants: BlockVariant[];
  /** Varian yang dipakai bila sekolah baru menambahkan blok ini. */
  defaultVariant: string;
  /** Field yang boleh diisi sekolah (divalidasi Zod terpisah). */
  fields: string[];
  /**
   * Boleh muncul lebih dari sekali di halaman depan?
   * Hampir semua tidak — mencegah halaman depan mengulang hal sama.
   */
  allowMultiple?: boolean;
  /** Blok ini hanya relevan bila sekolah membuka SPMB. */
  needsSpmb?: boolean;
};

/* ============================================================
 * KATALOG
 * ============================================================ */

const CORE_BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    key: "hero",
    name: "Pembuka",
    description: "Bagian paling atas: nama sekolah, semboyan, dan tombol utama.",
    icon: "🏫",
    requirement: "none",
    defaultVariant: "hero.besar-tengah",
    fields: ["title", "subtitle", "imageUrl", "ctaLabel", "ctaHref", "cta2Label", "cta2Href"],
    variants: [
      {
        key: "hero.besar-tengah",
        label: "Besar – tengah",
        hint: "Paling berwibawa. Cocok untuk sekolah yang ingin tampil mapan.",
      },
      {
        key: "hero.belah-dua",
        label: "Belah dua",
        hint: "Teks di kiri, gambar di kanan. Cocok menonjolkan gedung/kegiatan.",
      },
      {
        key: "hero.ringkas",
        label: "Ringkas",
        hint: "Pendek dan langsung. Cocok bila konten lain lebih penting.",
      },
    ],
  },
  {
    key: "spmb",
    name: "Ajakan Mendaftar (SPMB)",
    description: "Informasi penerimaan murid baru: gelombang, jalur, dan tombol daftar.",
    icon: "📝",
    requirement: "spmb",
    needsSpmb: true,
    defaultVariant: "spmb.kartu",
    fields: ["title", "subtitle"],
    variants: [
      {
        key: "spmb.kartu",
        label: "Kartu menonjol",
        hint: "Paling menarik perhatian. Baik untuk sekolah yang sedang gencar mencari murid.",
      },
      {
        key: "spmb.bilah",
        label: "Bilah ringkas",
        hint: "Ramah dan tidak memaksa. Cocok jika pendaftaran bukan fokus utama.",
      },
    ],
  },
  {
    key: "stats",
    name: "Angka Capaian",
    description: "Jumlah siswa, guru, kelas, atau capaian lain.",
    icon: "📊",
    requirement: "none",
    defaultVariant: "stats.tiga-angka",
    fields: ["heading", "items"],
    variants: [
      {
        key: "stats.tiga-angka",
        label: "Tiga angka",
        hint: "Tiga kotak sejajar. Paling mudah dibaca.",
        maxItems: 3,
      },
      {
        key: "stats.bilah-capaian",
        label: "Bilah capaian",
        hint: "Satu baris memanjang. Hemat ruang.",
        maxItems: 4,
      },
    ],
  },
  {
    key: "profile",
    name: "Profil Sekolah",
    description: "Sekilas tentang sekolah: sejarah, visi, atau keunggulan.",
    icon: "📄",
    requirement: "none",
    defaultVariant: "profile.teks-gambar",
    fields: ["heading", "body", "imageUrl", "imagePosition"],
    variants: [
      {
        key: "profile.teks-gambar",
        label: "Teks + gambar",
        hint: "Paling umum dan seimbang.",
      },
      {
        key: "profile.dua-kolom",
        label: "Dua kolom",
        hint: "Untuk teks panjang, mudah dibaca di layar lebar.",
      },
      {
        key: "profile.akordeon",
        label: "Akordeon",
        hint: "Ringkas; pembaca membuka bagian yang diminati.",
      },
    ],
  },
  {
    key: "news",
    name: "Berita & Kegiatan",
    description: "Tulisan terbaru dari sekolah.",
    icon: "📰",
    requirement: "posts",
    defaultVariant: "news.kartu-kolom",
    fields: ["heading", "subtitle", "itemCount"],
    variants: [
      {
        key: "news.kartu-kolom",
        label: "Kartu kolom",
        hint: "Tiga kartu sejajar. Klasik dan rapi.",
        maxItems: 6,
      },
      {
        key: "news.daftar",
        label: "Daftar",
        hint: "Mudah dipindai bila berita sering diperbarui.",
        maxItems: 8,
      },
      {
        key: "news.korsel",
        label: "Korsel",
        hint: "Menghemat ruang, cocok bila gambar berkualitas.",
        maxItems: 6,
      },
      {
        key: "news.sorotan",
        label: "Sorotan + daftar",
        hint: "Satu berita besar, sisanya daftar kecil.",
        maxItems: 5,
      },
    ],
  },
  {
    key: "agenda",
    name: "Agenda Kegiatan",
    description: "Jadwal kegiatan yang akan datang.",
    icon: "🗓️",
    requirement: "posts",
    defaultVariant: "agenda.linimasa",
    fields: ["heading", "itemCount"],
    variants: [
      {
        key: "agenda.linimasa",
        label: "Linimasa",
        hint: "Menonjolkan tanggal. Baik untuk banyak agenda.",
        maxItems: 6,
      },
      {
        key: "agenda.daftar",
        label: "Daftar ringkas",
        hint: "Padat. Baik untuk agenda sedikit.",
        maxItems: 4,
      },
    ],
  },
  {
    key: "gallery",
    name: "Galeri Foto",
    description: "Foto kegiatan sekolah.",
    icon: "🖼️",
    requirement: "gallery",
    defaultVariant: "gallery.kisi",
    fields: ["heading", "itemCount"],
    variants: [
      {
        key: "gallery.kisi",
        label: "Kisi seragam",
        hint: "Paling aman untuk semua jenis foto.",
        maxItems: 12,
      },
      {
        key: "gallery.mosaik",
        label: "Mosaik",
        hint: "Lebih hidup, tetapi sebaiknya pakai foto berukuran serupa.",
        maxItems: 9,
      },
    ],
  },
  {
    key: "teachers",
    name: "Guru & Tenaga Kependidikan",
    description: "Perkenalan guru dan staf.",
    icon: "👩‍🏫",
    requirement: "teachers",
    defaultVariant: "teachers.kisi-foto",
    fields: ["heading", "itemCount", "showPosition"],
    variants: [
      {
        key: "teachers.kisi-foto",
        label: "Kisi foto",
        hint: "Ramah dan personal. Perlu foto guru.",
        maxItems: 12,
      },
      {
        key: "teachers.daftar",
        label: "Daftar",
        hint: "Tanpa foto. Cocok bila foto belum tersedia.",
        maxItems: 40,
      },
    ],
  },
  {
    key: "faq",
    name: "Tanya Jawab",
    description: "Pertanyaan yang sering diajukan orang tua.",
    icon: "❓",
    requirement: "none",
    defaultVariant: "faq.akordeon",
    fields: ["heading", "items"],
    variants: [
      {
        key: "faq.akordeon",
        label: "Akordeon",
        hint: "Paling rapi untuk banyak pertanyaan.",
        maxItems: 12,
      },
      {
        key: "faq.dua-kolom",
        label: "Dua kolom",
        hint: "Semua jawaban terbuka sekaligus.",
        maxItems: 8,
      },
    ],
  },
  {
    key: "contact",
    name: "Kontak & Lokasi",
    description: "Alamat, telepon, jam layanan, dan peta.",
    icon: "📍",
    requirement: "contact",
    defaultVariant: "contact.peta-jam",
    fields: ["heading", "showMap", "showHours"],
    variants: [
      {
        key: "contact.peta-jam",
        label: "Peta + info",
        hint: "Paling informatif bagi pendaftar baru.",
      },
      {
        key: "contact.ringkas",
        label: "Ringkas",
        hint: "Hanya teks kontak, tanpa peta.",
      },
    ],
  },
];

/**
 * Katalog lengkap: blok inti (halaman depan) + blok general (halaman kustom).
 *
 * Digabung di SATU tempat supaya `getBlock`, `getVariant`, dan penyusun blok
 * otomatis mengenal keduanya — tanpa perlu mengubah berkas inti setiap kali
 * blok general ditambah.
 */
export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  ...CORE_BLOCK_DEFINITIONS,
  ...GENERAL_BLOCK_DEFINITIONS,
];

export function getBlock(key: string): BlockDefinition | undefined {
  return BLOCK_DEFINITIONS.find((b) => b.key === key);
}

export function getVariant(
  variantKey: string,
): { block: BlockDefinition; variant: BlockVariant } | undefined {
  for (const block of BLOCK_DEFINITIONS) {
    const variant = block.variants.find((v) => v.key === variantKey);
    if (variant) return { block, variant };
  }
  return undefined;
}

/** Apakah varian ini milik blok tersebut? Mencegah pasangan tidak sah. */
export function variantBelongsToBlock(
  blockKey: string,
  variantKey: string,
): boolean {
  const block = getBlock(blockKey);
  if (!block) return false;
  return block.variants.some((v) => v.key === variantKey);
}

/** Semua kunci varian yang sah (untuk validasi Zod). */
export function allVariantKeys(): string[] {
  return BLOCK_DEFINITIONS.flatMap((b) => b.variants.map((v) => v.key));
}

/** Semua kunci blok yang sah. */
export function allBlockKeys(): string[] {
  return BLOCK_DEFINITIONS.map((b) => b.key);
}

/* ============================================================
 * SUSUNAN AWAL
 * ============================================================ */

/**
 * Susunan bawaan untuk sekolah baru.
 *
 * Keputusan: "Pendaftaran diprioritaskan" — blok SPMB diletakkan tinggi.
 * Alasan: web sekolah yang dijual paling sering dipakai untuk mencari murid,
 * sehingga formulir perlu cepat terlihat. Sekolah dapat menggeser urutan ini
 * kapan saja, jadi pilihan ini murah untuk diubah.
 */
export const DEFAULT_HOMEPAGE_LAYOUT: { blockKey: string; variantKey: string }[] = [
  { blockKey: "hero", variantKey: "hero.besar-tengah" },
  { blockKey: "spmb", variantKey: "spmb.kartu" },
  { blockKey: "stats", variantKey: "stats.tiga-angka" },
  { blockKey: "profile", variantKey: "profile.teks-gambar" },
  { blockKey: "news", variantKey: "news.kartu-kolom" },
  { blockKey: "gallery", variantKey: "gallery.kisi" },
  { blockKey: "contact", variantKey: "contact.peta-jam" },
];

/**
 * Susunan alternatif bila sekolah lebih menonjolkan akademik.
 * Disediakan agar sekolah mapan (SMP/SMA favorit) bisa memilih dengan satu klik.
 */
export const ACADEMIC_HOMEPAGE_LAYOUT: { blockKey: string; variantKey: string }[] = [
  { blockKey: "hero", variantKey: "hero.besar-tengah" },
  { blockKey: "profile", variantKey: "profile.teks-gambar" },
  { blockKey: "stats", variantKey: "stats.tiga-angka" },
  { blockKey: "teachers", variantKey: "teachers.kisi-foto" },
  { blockKey: "news", variantKey: "news.kartu-kolom" },
  { blockKey: "agenda", variantKey: "agenda.linimasa" },
  { blockKey: "spmb", variantKey: "spmb.bilah" },
  { blockKey: "contact", variantKey: "contact.peta-jam" },
];

/* ============================================================
 * VALIDASI SUSUNAN
 * ============================================================ */

export type LayoutIssue = {
  severity: "error" | "warning";
  blockKey?: string;
  message: string;
};

/**
 * Periksa susunan blok halaman depan.
 *
 * Mengembalikan masalah, bukan melempar galat: UI perlu menampilkannya sebagai
 * peringatan agar sekolah bisa memperbaiki sendiri tanpa kehilangan kerjanya.
 */
export function validateLayout(
  blocks: { blockKey: string; variantKey: string; isEnabled?: boolean }[],
): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const enabled = blocks.filter((b) => b.isEnabled !== false);

  if (enabled.length === 0) {
    issues.push({
      severity: "error",
      message: "Halaman depan tidak punya blok aktif. Minimal satu blok diperlukan.",
    });
    return issues;
  }

  // 1. Blok ganda.
  const seen = new Set<string>();
  for (const b of enabled) {
    if (seen.has(b.blockKey)) {
      issues.push({
        severity: "error",
        blockKey: b.blockKey,
        message: `Blok "${getBlock(b.blockKey)?.name ?? b.blockKey}" muncul lebih dari sekali.`,
      });
    }
    seen.add(b.blockKey);
  }

  // 2. Blok tak dikenal / pasangan blok-varian tidak sah.
  for (const b of enabled) {
    const block = getBlock(b.blockKey);
    if (!block) {
      issues.push({
        severity: "error",
        blockKey: b.blockKey,
        message: `Blok "${b.blockKey}" tidak dikenal dan akan dilewati.`,
      });
      continue;
    }
    if (!variantBelongsToBlock(b.blockKey, b.variantKey)) {
      issues.push({
        severity: "error",
        blockKey: b.blockKey,
        message: `Gaya "${b.variantKey}" tidak tersedia untuk blok "${block.name}".`,
      });
    }
  }

  // 3. Blok SPMB tanpa pembuka di atasnya — kehilangan konteks.
  const firstReal = enabled.find((b) => b.blockKey !== "spmb");
  if (
    enabled[0]?.blockKey === "spmb" &&
    firstReal &&
    firstReal.blockKey !== "hero"
  ) {
    issues.push({
      severity: "warning",
      blockKey: "spmb",
      message:
        "Ajakan mendaftar berada di paling atas tanpa blok Pembuka. Pengunjung belum tahu ini sekolah mana.",
    });
  }

  // 4. Pembuka tidak di paling atas.
  const heroIdx = enabled.findIndex((b) => b.blockKey === "hero");
  if (heroIdx > 0) {
    issues.push({
      severity: "warning",
      blockKey: "hero",
      message: "Blok Pembuka biasanya diletakkan paling atas agar pengunjung langsung mengenal sekolah.",
    });
  }

  // 5. Halaman terlalu panjang.
  if (enabled.length > 9) {
    issues.push({
      severity: "warning",
      message: `Ada ${enabled.length} blok aktif. Halaman depan yang terlalu panjang membuat pengunjung berhenti menggulir.`,
    });
  }

  // 6. Ajakan mendaftar tidak ada padahal sekolah punya SPMB.
  if (!enabled.some((b) => b.blockKey === "spmb")) {
    issues.push({
      severity: "warning",
      blockKey: "spmb",
      message:
        "Blok Ajakan Mendaftar tidak dipakai. Pengunjung tidak diarahkan ke pendaftaran.",
    });
  }

  return issues;
}

/** True bila tidak ada masalah berseverity "error". */
export function layoutIsRenderable(issues: LayoutIssue[]): boolean {
  return !issues.some((i) => i.severity === "error");
}

/** Urutkan blok sesuai `order`, buang yang nonaktif, dan normalkan urutannya. */
export function normalizeLayout<T extends { blockKey: string; order: number; isEnabled?: boolean }>(
  blocks: T[],
): T[] {
  return [...blocks]
    .filter((b) => b.isEnabled !== false)
    .sort((a, b) => a.order - b.order)
    .map((b, i) => ({ ...b, order: i }));
}

/**
 * Bangun susunan awal dari daftar bawaan, dengan `order` berurutan.
 * Dipakai saat sekolah baru pertama kali membuka editor web.
 */
export function buildInitialLayout(
  template: { blockKey: string; variantKey: string }[] = DEFAULT_HOMEPAGE_LAYOUT,
): { blockKey: string; variantKey: string; order: number; isEnabled: boolean; props: Record<string, unknown> }[] {
  return template.map((t, i) => ({
    blockKey: t.blockKey,
    variantKey: t.variantKey,
    order: i,
    isEnabled: true,
    props: defaultPropsFor(t.blockKey),
  }));
}

/** Isi awal blok supaya editor tidak tampil kosong melompong. */
export function defaultPropsFor(blockKey: string): Record<string, unknown> {
  switch (blockKey) {
    case "hero":
      return {
        title: "",
        subtitle: "",
        imageUrl: "",
        ctaLabel: "Daftar Sekarang",
        ctaHref: "/spmb",
        cta2Label: "Hubungi Kami",
        cta2Href: "/kontak",
      };
    case "profile":
      return {
        heading: "Tentang Sekolah Kami",
        body: "",
        imageUrl: "",
        imagePosition: "kanan",
      };
    case "stats":
      // Kosong, bukan "0/0/0". Nol yang dicetak sebagai fakta di halaman publik
      // merusak kredibilitas sekolah; pengisian otomatis terjadi di
      // `getHomepageBlocks` / `fallbackHomepageBlocks`.
      return {
        heading: "Sekolah Kami dalam Angka",
        items: [],
      };
    case "news":
      return { heading: "Berita & Kegiatan", subtitle: "", itemCount: 3 };
    case "agenda":
      return { heading: "Agenda Mendatang", itemCount: 4 };
    case "gallery":
      return { heading: "Galeri Kegiatan", itemCount: 6 };
    case "teachers":
      return { heading: "Guru & Tenaga Kependidikan", itemCount: 6, showPosition: true };
    case "faq":
      return { heading: "Pertanyaan yang Sering Diajukan", items: [] };
    case "contact":
      return { heading: "Hubungi Kami", showMap: true, showHours: true };
    case "spmb":
      return { title: "Penerimaan Murid Baru", subtitle: "" };

    /* ---- Blok general (halaman kustom) ---- */
    case "richtext":
      return { heading: "", body: "" };
    case "section":
      return { heading: "", subheading: "" };
    case "image":
      return { imageUrl: "", alt: "", caption: "" };
    case "table":
      return {
        heading: "",
        // Dua kolom dan satu baris kosong: cukup untuk memperlihatkan bentuk
        // tabel tanpa memaksa operator menghapus baris yang tidak dipakai.
        columns: [{ label: "" }, { label: "" }],
        rows: [{ c0: "", c1: "", c2: "", c3: "", c4: "" }],
        footnote: "",
      };
    case "steps":
      return { heading: "", items: [{ title: "", body: "" }] };
    case "timeline":
      return { heading: "", items: [{ year: "", title: "", body: "" }] };
    case "cards":
      return {
        heading: "",
        items: [{ title: "", body: "", imageUrl: "", value: "" }],
      };
    case "downloads":
      return { heading: "", items: [{ title: "", url: "", note: "", size: "" }] };
    case "achievements":
      return {
        heading: "",
        items: [{ year: "", title: "", winner: "", level: "" }],
      };
    case "quote":
      return { quote: "", attribution: "", role: "", photoUrl: "" };
    case "video":
      return { heading: "", youtubeUrl: "", caption: "" };
    case "divider":
      return { label: "" };
    default:
      return {};
  }
}
