import type { Config } from "tailwindcss";

/**
 * Design tokens — "Papan tulis & arsip sekolah"
 * Arah: bersih, tenang, informatif, sedikit hangat.
 * Hijau papan tulis dipakai HEMAT (aksi utama & status aktif saja).
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1B2430",      // teks utama (biru-arang dalam)
        paper: "#FBFAF7",    // background (kertas hangat)
        board: {
          DEFAULT: "#1F4B43", // aksen brand (hijau papan tulis)
          dark: "#163832",
          light: "#2C6357",
        },
        chalk: "#E8E4DA",    // border & surface sekunder (kapur)
        marker: "#C4452D",   // aksen peringatan/penting (merah spidol)
        slate: {
          DEFAULT: "#64748B", // teks sekunder
          light: "#94A3B8",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      fontSize: {
        // Type scale berbasis Elements of Typographic Style
        xs: ["0.75rem", { lineHeight: "1.5" }],
        sm: ["0.875rem", { lineHeight: "1.5" }],
        base: ["1rem", { lineHeight: "1.65" }],
        lg: ["1.125rem", { lineHeight: "1.6" }],
        xl: ["1.375rem", { lineHeight: "1.4" }],
        "2xl": ["1.75rem", { lineHeight: "1.3" }],
        "3xl": ["2.25rem", { lineHeight: "1.2" }],
        "4xl": ["3rem", { lineHeight: "1.1" }],
      },
      borderRadius: {
        // Radius beda per hierarki (bukan satu radius seragam)
        sm: "4px",
        DEFAULT: "6px",
        lg: "10px",
      },
      spacing: {
        sidebar: "16rem",
      },
      maxWidth: {
        prose: "68ch", // < 80 karakter
      },
    },
  },
  plugins: [],
};

export default config;
