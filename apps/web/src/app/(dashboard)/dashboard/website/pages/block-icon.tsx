/**
 * Ikon blok sebagai SVG sebaris.
 *
 * ============================================================
 * KENAPA BUKAN EMOJI
 * ============================================================
 * Blok lama memakai emoji (`"🏫"`). `AGENTS.md` melarangnya, dan alasannya
 * terlihat di sini: emoji tampil berbeda di setiap sistem operasi (Apple,
 * Windows, Android masing-masing punya gambar sendiri), tidak bisa diwarnai
 * mengikuti tema, dan ukurannya tidak bisa disetel. Akibatnya katalog blok
 * terlihat berbeda di tiap komputer sekolah — dan tidak bisa mengikuti warna
 * papan tulis aplikasi.
 *
 * SVG sebaris mewarisi `currentColor`, jadi ikon otomatis mengikuti warna teks
 * di sekitarnya (aktif, tersorot, nonaktif) tanpa aturan tambahan.
 *
 * ============================================================
 * KENAPA KATALOG IKON LOKAL, BUKAN PUSTAKA
 * ============================================================
 * Hanya ~20 ikon dibutuhkan. Menambah pustaka ikon berarti menambah ratusan
 * kilobita ke setiap pemuatan halaman admin — untuk dua puluh gambar.
 */

const ICONS: Record<string, string> = {
  /* Blok inti (halaman depan) — dipetakan agar katalog lama tetap punya ikon. */
  hero: "M4 5.5h16v13H4zM4 15l4.5-4.5 3.5 3.5 3-3 5 5",
  spmb: "M6 3.5h9l3 3v14H6zM9 9h6M9 12.5h6M9 16h4",
  stats: "M5 19V11M12 19V5M19 19v-5",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0",
  news: "M4 5.5h12v13H4zM16 9h4v9.5h-4M7 9h6M7 12h6M7 15h4",
  agenda: "M4.5 6.5h15v13h-15zM8 3.5v4M16 3.5v4M4.5 11h15",
  gallery: "M4 5.5h16v13H4zM4 15l4.5-4.5 3.5 3.5 3-3 5 5M15.5 9.5h.02",
  teachers: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M17 11.5a3 3 0 0 0 0-6M18 20a6 6 0 0 0-2-4.4",
  faq: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM9.6 9.5a2.4 2.4 0 1 1 3 2.3v1.4M12 16.5h.02",
  contact: "M12 20.5s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0c0 4.5 6.5 10.5 6.5 10.5zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",

  /* Blok general (halaman kustom). */
  text: "M5 6.5h14M5 12h14M5 17.5h9",
  section: "M4 7h16M4 12h10M4 17h7",
  image: "M4 5.5h16v13H4zM4 15l4.5-4.5 3.5 3.5 3-3 5 5M15.5 9.5h.02",
  table: "M4 6h16v12H4zM4 10.5h16M4 15h16M10 6v12",
  steps: "M5 7.5h3v3H5zM5 14h3v3H5zM11 9h8M11 15.5h8",
  timeline: "M6 4v16M6 8.5h6M6 15.5h9",
  cards: "M4 6.5h7v7H4zM13 6.5h7v7h-7zM4 15.5h7v2H4zM13 15.5h7v2h-7z",
  downloads: "M12 4v10M8 10.5l4 4 4-4M4.5 19h15",
  quote: "M6 15.5c-1.2 0-2-.9-2-2.1 0-2.4 1.6-4.4 4-5.4l.7 1.4c-1.6.7-2.6 1.9-2.7 3 .2-.1.5-.2.8-.2 1.1 0 1.9.8 1.9 1.9s-.9 1.9-2.1 1.9zM16 15.5c-1.2 0-2-.9-2-2.1 0-2.4 1.6-4.4 4-5.4l.7 1.4c-1.6.7-2.6 1.9-2.7 3 .2-.1.5-.2.8-.2 1.1 0 1.9.8 1.9 1.9s-.9 1.9-2.1 1.9z",
  video: "M4 6.5h11v11H4zM15 10l5-3v10l-5-3",
  achievements: "M8 4.5h8v5a4 4 0 0 1-8 0zM8 6H5.5v2A2.5 2.5 0 0 0 8 10.5M16 6h2.5v2A2.5 2.5 0 0 1 16 10.5M12 13.5v3M9 20h6M9 16.5h6",
  divider: "M4 12h16M8 8.5h8M8 15.5h8",

  /* Tombol penyusun. */
  up: "M12 19V6M6.5 11.5 12 6l5.5 5.5",
  down: "M12 5v13M6.5 12.5 12 18l5.5-5.5",
  eye: "M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  eyeOff: "M4 4l16 16M9.5 9.6a2.5 2.5 0 0 0 3.4 3.4M6.4 6.6C4 8.3 2.5 12 2.5 12S6 17.5 12 17.5c1.6 0 3-.4 4.2-1M17.8 15C20.3 13.3 21.5 12 21.5 12S18 6.5 12 6.5c-.7 0-1.4.1-2 .2",
  copy: "M9 9h9.5v9.5a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5V10.5A1.5 1.5 0 0 1 9 9zM5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5",
  trash: "M4.5 6.5h15M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7M6.5 6.5l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12",
};

/** Ikon cadangan bila nama tidak dikenal — kotak, bukan ikon rusak. */
const FALLBACK = "M4 5.5h16v13H4z";

export function BlockIcon({
  name,
  className = "h-4 w-4",
}: {
  name: string;
  className?: string;
}) {
  const d = ICONS[name] ?? FALLBACK;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
