import type { ReactNode } from "react";
import Link from "next/link";
import { sanitizeRichText } from "@/lib/rich-text";

/**
 * Komponen bersama untuk SEMUA blok web sekolah.
 *
 * Alasan file ini ada: tanpa komponen bersama, tiap penulis blok akan membuat
 * versi sendiri-sendiri — jarak, ukuran judul, dan warna jadi berbeda-beda,
 * dan halaman depan terlihat seperti hasil tempel-tempel. Semua blok WAJIB
 * memakai komponen di sini.
 *
 * Semua warna diambil dari CSS variable tema (diisi oleh layout publik), jadi
 * blok tidak boleh memakai warna Tailwind tetap seperti `bg-blue-600`.
 */

/* ============================================================
 * PEMBUNGKUS BAGIAN
 * ============================================================ */

/** Jarak vertikal antar blok — satu-satunya tempat spasi bagian ditentukan. */
export function Section({
  children,
  className = "",
  id,
  /** Latar berbeda agar blok bersebelahan tidak menyatu. */
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "default" | "surface" | "primary";
}) {
  const bg =
    tone === "surface"
      ? "bg-[var(--site-surface)]"
      : tone === "primary"
        ? "bg-[var(--site-primary)] text-[var(--site-primary-text)]"
        : "bg-[var(--site-bg)]";

  return (
    <section id={id} className={`${bg} ${className}`}>
      {/*
        Spasi memakai clamp(): rapat di ponsel, lapang di layar besar.
        Padding tetap (mis. py-16 di semua ukuran) membuat halaman terasa
        sesak di ponsel dan kaku di desktop — dua keluhan sekaligus dari satu
        angka yang salah.
      */}
      <div className="mx-auto w-full max-w-6xl px-[clamp(1rem,4vw,1.5rem)] py-[clamp(3rem,7vw,5.5rem)]">
        {children}
      </div>
    </section>
  );
}

/** Judul bagian dengan pengantar opsional, ditata seragam. */
export function SectionHeading({
  title,
  subtitle,
  /** Teks tengah (untuk blok yang bersifat ajakan). */
  align = "left",
  /** Warna mengikuti blok bertema terang. */
  onPrimary = false,
}: {
  title?: string;
  subtitle?: string;
  align?: "left" | "center";
  onPrimary?: boolean;
}) {
  if (!title && !subtitle) return null;

  // Judul di tengah memakai goresan kapur di bawahnya: satu penanda visual
  // yang mengingatkan papan tulis, dipakai hemat agar tidak jadi hiasan.
  const centered = align === "center";

  return (
    <div
      className={`mb-[clamp(1.75rem,4vw,2.75rem)] ${
        centered ? "text-center" : ""
      }`}
    >
      {title ? (
        <h2
          className={`font-[family-name:var(--site-heading-font)] font-bold tracking-tight ${
            onPrimary ? "" : "text-[var(--site-text)]"
          }`}
          style={{
            fontSize: "clamp(1.5rem, 1.15rem + 1.6vw, 2.25rem)",
            lineHeight: 1.15,
          }}
        >
          {title}
        </h2>
      ) : null}

      {title ? (
        <span
          aria-hidden
          className={`site-rule mt-3 block h-[3px] w-14 ${
            onPrimary ? "bg-[var(--site-accent)]" : "bg-[var(--site-primary)]"
          } ${centered ? "mx-auto" : ""}`}
        />
      ) : null}

      {subtitle ? (
        <p
          className={`mt-4 text-base leading-relaxed sm:text-[1.0625rem] ${
            onPrimary ? "opacity-90" : "text-[var(--site-muted)]"
          } ${centered ? "mx-auto max-w-2xl" : "max-w-2xl"}`}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/* ============================================================
 * TOMBOL
 * ============================================================ */

/**
 * Tombol. Warna teks SELALU dari `--site-primary-text` yang dijamin kontras
 * oleh lib/site-themes.ts, bukan dipilih manual di sini.
 */
export function SiteButton({
  href,
  children,
  variant = "solid",
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline" | "accent";
  external?: boolean;
}) {
  /*
   * Gerak: hanya `transform` dan warna. Tombol yang membesar karena padding
   * akan menggeser tata letak di sekitarnya — dan pada baris tombol, tombol
   * lain ikut bergerak, yang terbaca sebagai halaman bergetar.
   */
  const base =
    "group/btn inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-200 ease-out will-change-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:hover:translate-y-0";
  const style = { borderRadius: "var(--site-radius-button)" };

  const look =
    variant === "solid"
      ? "bg-[var(--site-primary)] text-[var(--site-primary-text)] hover:shadow-[0_6px_18px_-8px_var(--site-primary)]"
      : variant === "accent"
        ? "bg-[var(--site-accent)] text-[var(--site-accent-text)] hover:shadow-[0_6px_18px_-8px_var(--site-accent)]"
        : "border-2 border-[var(--site-primary)] text-[var(--site-primary)] hover:bg-[var(--site-primary)] hover:text-[var(--site-primary-text)]";

  const cls = `${base} ${look}`;

  // Tautan luar memakai <a> agar tidak melalui router internal.
  if (external || /^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={cls} style={style}>
      {children}
    </Link>
  );
}

/* ============================================================
 * KARTU
 * ============================================================ */

export function SiteCard({
  children,
  className = "",
  /** Kartu di atas latar berwarna perlu gaya berbeda. */
  onPrimary = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  onPrimary?: boolean;
  /** Gaya sebaris, mis. variabel `--i` untuk jeda animasi berurutan. */
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`site-lift ${className} ${
        onPrimary
          ? "border border-white/25 bg-white/10"
          : // Bingkai menguat saat disorot — pengganti bayangan yang lebih
            // tenang, dan mengingatkan garis tepi buku arsip.
            "border border-[var(--site-border)] bg-[var(--site-surface)] hover:border-[var(--site-primary)]"
      }`}
      style={{ borderRadius: "var(--site-radius-card)", ...style }}
    >
      {children}
    </div>
  );
}

/* ============================================================
 * KEADAAN KOSONG
 * ============================================================ */

/**
 * Ditampilkan bila blok butuh data yang belum ada.
 *
 * Sengaja TIDAK menyembunyikan blok sepenuhnya: kalau blok hilang begitu saja,
 * sekolah bingung kenapa halaman depannya berbeda dari yang mereka atur. Pesan
 * yang jelas membuat mereka tahu apa yang harus dilakukan.
 */
export function BlockEmpty({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div
      className="border border-dashed border-[var(--site-border)] px-6 py-10 text-center"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <p className="text-sm font-medium text-[var(--site-text)]">{message}</p>
      {hint ? <p className="mt-1 text-sm text-[var(--site-muted)]">{hint}</p> : null}
    </div>
  );
}

/* ============================================================
 * GAMBAR
 * ============================================================ */

/**
 * Gambar dengan rasio tetap.
 *
 * Rasio dikunci supaya foto berukuran berbeda-beda tidak membuat tata letak
 * melompat-lompat saat halaman dimuat.
 */
export function SiteImage({
  src,
  alt,
  ratio = "16/9",
  className = "",
  /** Gambar membesar halus saat induknya disorot (induk perlu kelas `group`). */
  zoomOnHover = false,
}: {
  src?: string | null;
  alt: string;
  ratio?: "16/9" | "4/3" | "1/1" | "3/4";
  className?: string;
  zoomOnHover?: boolean;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--site-muted)]/10 ${className}`}
        style={{ aspectRatio: ratio, borderRadius: "var(--site-radius-card)" }}
        aria-hidden="true"
      >
        {/*
          SVG sebaris, BUKAN emoji. Emoji tampil berbeda di setiap sistem
          operasi (Apple, Windows, Android masing-masing punya gambarnya), tidak
          bisa diwarnai mengikuti tema sekolah, dan ukurannya tidak bisa
          disetel. SVG mewarisi `currentColor` sehingga ikut tema.
        */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-[var(--site-muted)] opacity-50"
        >
          <path d="M4 5.5h16v13H4z" />
          <path d="M4 15l4.5-4.5 3.5 3.5 3-3 5 5" />
          <circle cx="15.5" cy="9.5" r="1" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden bg-[var(--site-muted)]/10 ${className}`}
      style={{ aspectRatio: ratio, borderRadius: "var(--site-radius-card)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`h-full w-full object-cover ${
          zoomOnHover
            ? // Membesar perlahan saat kartu disorot. Skala kecil saja (1.04):
              // lebih dari itu membuat gambar terlihat "melompat", dan pada
              // foto wajah justru mengganggu.
              "transition-transform duration-[600ms] ease-out group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
            : ""
        }`}
      />
    </div>
  );
}

/* ============================================================
 * TEKS
 * ============================================================ */

/** Isi paragraf panjang dari teks biasa (mempertahankan baris kosong). */
export function Prose({ text, onPrimary = false }: { text: string; onPrimary?: boolean }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  return (
    <div className={`space-y-4 ${onPrimary ? "" : "text-[var(--site-text)]"}`}>
      {paragraphs.map((p, i) => (
        <p key={i} className="text-base leading-relaxed whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

/**
 * Isi tulisan dari editor teks kaya (HTML) — disanitasi sebelum ditampilkan.
 *
 * Menerima DUA bentuk isi sekaligus:
 *   - tulisan baru → HTML dari editor;
 *   - tulisan lama → teks polos yang dipisah baris kosong.
 *
 * Kompatibilitas ini bukan kemalasan: database sudah berisi tulisan sekolah
 * yang ditulis sebelum editor ada. Memaksa semuanya menjadi HTML berarti
 * tulisan lama tampil sebagai satu blok panjang tanpa paragraf.
 */
export function RichContent({ html }: { html: string }) {
  const clean = sanitizeRichText(html);
  if (!clean) return null;

  // Tanpa tag blok apa pun, isi ini teks polos — pakai pemisahan paragraf.
  const isPlain = !/<(p|h[1-6]|ul|ol|li|blockquote|hr|br)\b/i.test(clean);
  if (isPlain) return <Prose text={clean} />;

  return (
    <div
      className="rich-content text-base leading-relaxed text-[var(--site-text)]"
      // Aman: `clean` sudah melewati daftar-putih tag & atribut (lihat
      // lib/rich-text.ts) — script, iframe, dan atribut on* tidak lolos.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

/** Tanggal berbahasa Indonesia, singkat. */
export function formatSiteDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Tanggal + jam untuk agenda. */
export function formatSiteDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
