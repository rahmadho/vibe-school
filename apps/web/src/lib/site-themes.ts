/**
 * Tema visual web sekolah — MURNI (tanpa DB), sehingga dapat diuji.
 *
 * KENAPA PRESET, BUKAN PEMILIH WARNA BEBAS:
 * sekolah akan memilih warna yang terlihat bagus di layar mereka, tetapi
 * menghasilkan teks abu-abu di atas latar kuning yang tidak terbaca. Halaman
 * sekolah yang tidak terbaca membuat nama produk kita terlihat buruk.
 *
 * Karena itu: sekolah memilih PRESET yang sudah diuji kontrasnya, dan hanya
 * boleh menyesuaikan warna AKSEN. Warna dasar (teks & latar) tidak diubah.
 */

/* ============================================================
 * TIPE
 * ============================================================ */

export type ThemePreset = {
  key: string;
  name: string;
  /** Untuk siapa tema ini cocok. */
  description: string;
  /** Warna aksen utama (hex). */
  primary: string;
  /** Warna aksen kedua / penegas (hex). */
  accent: string;
  /** Warna latar halaman (hex). */
  background: string;
  /** Warna permukaan kartu (hex). */
  surface: string;
  /** Warna teks utama (hex). */
  text: string;
  /** Contoh: swatch untuk pemilih tema di UI. */
  swatch: [string, string, string];
};

export type FontChoice = {
  key: string;
  name: string;
  /** Kelas CSS variabel font (didefinisikan di layout). */
  cssVar: string;
  /** Untuk judul atau isi. */
  use: "heading" | "body";
  description: string;
};

export type CornerStyle = {
  key: string;
  name: string;
  /** Nilai border-radius untuk kartu & tombol. */
  radiusCard: string;
  radiusButton: string;
  description: string;
};

/* ============================================================
 * PRESET TEMA
 * ============================================================ */

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: "akademik-biru",
    name: "Biru Akademik",
    description: "Tenang dan terpercaya. Pilihan aman untuk hampir semua sekolah.",
    primary: "#1E40AF",
    accent: "#0EA5E9",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    text: "#0F172A",
    swatch: ["#1E40AF", "#0EA5E9", "#F8FAFC"],
  },
  {
    key: "pesantren-hijau",
    name: "Hijau Pesantren",
    description: "Sejuk dan menenangkan. Cocok untuk sekolah bernuansa keagamaan.",
    primary: "#047857",
    accent: "#84CC16",
    background: "#F7FBF8",
    surface: "#FFFFFF",
    text: "#052E22",
    swatch: ["#047857", "#84CC16", "#F7FBF8"],
  },
  {
    key: "negeri-tegas",
    name: "Merah Tegas",
    description: "Berwibawa dan bersemangat. Cocok untuk sekolah negeri yang mapan.",
    primary: "#B91C1C",
    accent: "#F59E0B",
    background: "#FEFBF7",
    surface: "#FFFFFF",
    text: "#1C0A0A",
    swatch: ["#B91C1C", "#F59E0B", "#FEFBF7"],
  },
  {
    key: "ramah-jingga",
    name: "Jingga Ramah",
    description: "Hangat dan mengundang. Cocok untuk TK dan SD.",
    primary: "#C2410C",
    accent: "#FACC15",
    background: "#FFFBF5",
    surface: "#FFFFFF",
    text: "#1F1206",
    swatch: ["#C2410C", "#FACC15", "#FFFBF5"],
  },
  {
    key: "modern-ungu",
    name: "Ungu Modern",
    description: "Segar dan berbeda. Cocok untuk sekolah dengan citra inovatif.",
    primary: "#6D28D9",
    accent: "#EC4899",
    background: "#FAF8FF",
    surface: "#FFFFFF",
    text: "#1A0B33",
    swatch: ["#6D28D9", "#EC4899", "#FAF8FF"],
  },
  {
    key: "netral-elegan",
    name: "Netral Elegan",
    description: "Mewah tanpa mencolok. Cocok untuk SMA/SMK favorit.",
    primary: "#334155",
    accent: "#C0A062",
    background: "#F8F8F7",
    surface: "#FFFFFF",
    text: "#111827",
    swatch: ["#334155", "#C0A062", "#F8F8F7"],
  },
];

/* ============================================================
 * HURUF
 * ============================================================ */

export const HEADING_FONTS: FontChoice[] = [
  {
    key: "fraunces",
    name: "Fraunces",
    cssVar: "--font-fraunces",
    use: "heading",
    description: "Berwibawa dan hangat. Bawaan proyek ini.",
  },
  {
    key: "public-sans",
    name: "Public Sans",
    cssVar: "--font-public-sans",
    use: "heading",
    description: "Netral dan bersih. Terlihat modern.",
  },
];

export const BODY_FONTS: FontChoice[] = [
  {
    key: "public-sans",
    name: "Public Sans",
    cssVar: "--font-public-sans",
    use: "body",
    description: "Sangat mudah dibaca di layar kecil.",
  },
  {
    key: "system",
    name: "Bawaan sistem",
    cssVar: "--font-system",
    use: "body",
    description: "Paling cepat dimuat karena tidak ada unduhan huruf.",
  },
];

export const CORNER_STYLES: CornerStyle[] = [
  {
    key: "tegas",
    name: "Tegas",
    radiusCard: "0.25rem",
    radiusButton: "0.25rem",
    description: "Sudut hampir siku. Terkesan formal.",
  },
  {
    key: "lembut",
    name: "Lembut",
    radiusCard: "0.75rem",
    radiusButton: "0.5rem",
    description: "Seimbang. Bawaan proyek ini.",
  },
  {
    key: "bulat",
    name: "Bulat",
    radiusCard: "1.5rem",
    radiusButton: "9999px",
    description: "Ramah dan santai. Cocok untuk TK/SD.",
  },
];

/* ============================================================
 * PENCARIAN
 * ============================================================ */

export function getPreset(key: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.key === key);
}

export function getCornerStyle(key: string): CornerStyle | undefined {
  return CORNER_STYLES.find((c) => c.key === key);
}

export function getHeadingFont(key: string): FontChoice | undefined {
  return HEADING_FONTS.find((f) => f.key === key);
}

export function getBodyFont(key: string): FontChoice | undefined {
  return BODY_FONTS.find((f) => f.key === key);
}

export const DEFAULT_THEME_KEY = "akademik-biru";
export const DEFAULT_CORNER_STYLE = "lembut";
export const DEFAULT_HEADING_FONT = "fraunces";
export const DEFAULT_BODY_FONT = "public-sans";

/**
 * Ambang kontras minimum untuk teks di atas warna aksen (WCAG AA, teks biasa).
 * Dipakai `bestTextOn()` dan diuji agar label tombol selalu terbaca.
 */
export const BEST_TEXT_CONTRAST_MIN = 4.5;

/* ============================================================
 * WARNA & KONTRAS
 * ============================================================ */

/** Ubah hex (#RRGGBB atau #RGB) menjadi [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b].every((n) => !Number.isNaN(n)) ? [r, g, b] : null;
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b].every((n) => !Number.isNaN(n)) ? [r, g, b] : null;
}

export function isValidHex(hex: string): boolean {
  return hexToRgb(hex) !== null;
}

/** Luminansi relatif menurut WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Rasio kontras WCAG antara dua warna (1..21).
 * Ambang WCAG AA: 4.5 untuk teks biasa, 3.0 untuk teks besar.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/**
 * Apakah aman memakai `foreground` di atas `background` untuk teks biasa?
 * Dipakai editor web untuk memberi peringatan saat sekolah mengubah warna aksen.
 */
export function isReadable(
  foreground: string,
  background: string,
  large = false,
): boolean {
  const min = large ? 3 : 4.5;
  return contrastRatio(foreground, background) >= min;
}

/**
 * Pilih warna teks (putih/hitam) yang paling terbaca di atas latar tertentu.
 * Dipakai tombol berwarna aksen agar labelnya selalu terbaca.
 */
export function bestTextOn(background: string): string {
  const white = contrastRatio("#FFFFFF", background);
  const black = contrastRatio("#111827", background);
  return white >= black ? "#FFFFFF" : "#111827";
}

/* ============================================================
 * TEMA EFEKTIF
 * ============================================================ */

export type EffectiveTheme = {
  presetKey: string;
  primary: string;
  primaryText: string;
  accent: string;
  accentText: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  radiusCard: string;
  radiusButton: string;
  headingFontVar: string;
  bodyFontVar: string;
  /** Peringatan kontras (kosong = aman). */
  warnings: string[];
};

/**
 * Gabungkan preset dengan penyesuaian sekolah menjadi tema siap pakai.
 *
 * Nilai yang tidak sah (hex cacat atau preset tak dikenal) DIABAIKAN dan
 * diganti bawaan — lebih baik tampil normal daripada halaman rusak karena
 * satu nilai salah.
 *
 * PERHATIAN soal `warnings`: daftar ini ditujukan untuk EDITOR (agar operator
 * tahu isiannya salah), bukan untuk halaman publik. Preset tak dikenal tidak
 * diberi peringatan karena biasanya berasal dari data lama; warna cacat diberi
 * peringatan karena berasal dari isian operator yang baru saja diketik.
 */
export function resolveTheme(input: {
  preset?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  headingFont?: string | null;
  bodyFont?: string | null;
  cornerStyle?: string | null;
}): EffectiveTheme {
  const preset = getPreset(input.preset ?? "") ?? getPreset(DEFAULT_THEME_KEY)!;
  const warnings: string[] = [];

  let primary = preset.primary;
  if (input.primaryColor) {
    if (isValidHex(input.primaryColor)) primary = input.primaryColor;
    else warnings.push(`Warna utama "${input.primaryColor}" tidak sah; memakai warna preset.`);
  }

  let accent = preset.accent;
  if (input.accentColor) {
    if (isValidHex(input.accentColor)) accent = input.accentColor;
    else warnings.push(`Warna aksen "${input.accentColor}" tidak sah; memakai warna preset.`);
  }

  // Teks di atas warna aksen harus tetap terbaca, apa pun warna pilihannya.
  const primaryText = bestTextOn(primary);
  const accentText = bestTextOn(accent);

  // Teks utama di atas latar harus aman; kalau tidak, jatuhkan ke warna preset.
  if (!isReadable(preset.text, preset.background)) {
    warnings.push("Kontras teks pada latar kurang. Memakai warna teks bawaan.");
  }

  const corner = getCornerStyle(input.cornerStyle ?? "") ??
    getCornerStyle(DEFAULT_CORNER_STYLE)!;
  const headingFont = getHeadingFont(input.headingFont ?? "") ??
    getHeadingFont(DEFAULT_HEADING_FONT)!;
  const bodyFont = getBodyFont(input.bodyFont ?? "") ?? getBodyFont(DEFAULT_BODY_FONT)!;

  return {
    presetKey: preset.key,
    primary,
    primaryText,
    accent,
    accentText,
    background: preset.background,
    surface: preset.surface,
    text: preset.text,
    mutedText: mixToward(preset.text, preset.background, 0.45),
    border: mixToward(preset.text, preset.background, 0.85),
    radiusCard: corner.radiusCard,
    radiusButton: corner.radiusButton,
    headingFontVar: headingFont.cssVar,
    bodyFontVar: bodyFont.cssVar,
    warnings,
  };
}

/** Campur dua warna hex. `amount` 0 = pakai `a`, 1 = pakai `b`. */
export function mixToward(a: string, b: string, amount: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  const t = Math.max(0, Math.min(1, amount));
  const mix = ra.map((v, i) => Math.round(v * (1 - t) + rb[i] * t));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * Periksa apakah penyesuaian warna sekolah masih aman.
 * Mengembalikan daftar masalah agar UI bisa memperingatkan tanpa memblokir.
 */
export function checkThemeSafety(input: {
  preset?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}): { severity: "error" | "warning"; message: string }[] {
  const out: { severity: "error" | "warning"; message: string }[] = [];
  const preset = getPreset(input.preset ?? "") ?? getPreset(DEFAULT_THEME_KEY)!;

  if (input.primaryColor && !isValidHex(input.primaryColor)) {
    out.push({ severity: "error", message: "Kode warna utama bukan hex yang sah." });
  }
  if (input.accentColor && !isValidHex(input.accentColor)) {
    out.push({ severity: "error", message: "Kode warna aksen bukan hex yang sah." });
  }

  if (input.primaryColor && isValidHex(input.primaryColor)) {
    // Tombol memakai warna aksen sebagai latar; label harus terbaca.
    const r = contrastRatio(bestTextOn(input.primaryColor), input.primaryColor);
    if (r < 4.5) {
      out.push({
        severity: "warning",
        message: `Kontras tombol hanya ${r}:1. Teks pada tombol mungkin sulit dibaca.`,
      });
    }
    // Warna utama juga dipakai sebagai teks/judul di atas latar preset.
    const onBg = contrastRatio(input.primaryColor, preset.background);
    if (onBg < 3) {
      out.push({
        severity: "warning",
        message: `Judul berwarna utama nyaris tidak terlihat di latar (kontras ${onBg}:1).`,
      });
    }
  }

  return out;
}

/** Preset yang direkomendasikan berdasarkan jenjang sekolah. */
export function recommendPreset(level: string): string {
  switch (level) {
    case "TK":
    case "SD":
    case "MI":
      return "ramah-jingga";
    case "MI ":
    case "MTs":
    case "MA":
      return "pesantren-hijau";
    case "SMA":
    case "SMK":
      return "netral-elegan";
    default:
      return DEFAULT_THEME_KEY;
  }
}
