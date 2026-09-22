import { Section, SiteButton, SiteImage } from "@/components/site/site-ui";

/**
 * Blok "hero" (Pembuka) — 3 varian gaya.
 *
 * POLA WAJIB untuk semua blok:
 *  1. Terima `props` bertipe sudah divalidasi + `schoolName`, `logoUrl`, `theme`.
 *  2. Pilih varian lewat `variantKey`, JANGAN lewat prop terpisah.
 *  3. Warna HANYA dari CSS variable (--site-*), tidak pernah warna Tailwind tetap.
 *  4. Bila data kurang, tampilkan `BlockEmpty` — jangan render kosong.
 *  5. Return satu elemen pembungkus; jangan mengembalikan null diam-diam.
 *
 * ============================================================
 * KENAPA PEMBUKA INI DIGARAP LEBIH SERIUS DARI BLOK LAIN
 * ============================================================
 * Ini satu-satunya blok yang dilihat SETIAP pengunjung, dan yang menentukan
 * apakah orang tua percaya pada sekolah ini dalam tiga detik pertama. Karena
 * itu ia mendapat dua hal yang tidak diberikan ke blok lain:
 *
 *   1. GERAK BERTAHAP — logo, judul, kalimat pengantar, lalu tombol, masing
 *      masing muncul berurutan. Satu momen pembuka yang teratur terbaca
 *      sebagai "ditujukan", bukan sebagai animasi.
 *
 *   2. UKURAN FLUID — judul memakai `clamp()` sehingga tumbuh mengikuti lebar
 *      layar. Ukuran tetap (mis. text-4xl) membuat judul panjang pecah
 *      berantakan di ponsel dan terlihat kecil di desktop lebar.
 *
 * Gerak hanya memakai opacity dan transform: keduanya dijalankan kartu grafis,
 * jadi halaman tetap mulus di ponsel kelas bawah yang dipakai banyak orang tua.
 */

export type HeroProps = {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  cta2Label?: string;
  cta2Href?: string;
};

export function HeroBlock({
  props,
  variantKey,
  schoolName,
  logoUrl,
}: {
  props: HeroProps;
  variantKey: string;
  schoolName: string;
  logoUrl?: string | null;
}) {
  // Bila sekolah belum mengisi judul, pakai nama sekolah agar blok tidak kosong.
  const title = props.title?.trim() || schoolName;
  const subtitle = props.subtitle?.trim() || "";
  const image = props.imageUrl?.trim() || "";
  const hasCta = Boolean(props.ctaLabel && props.ctaHref);
  const hasCta2 = Boolean(props.cta2Label && props.cta2Href);

  const actions = (
    <>
      {hasCta ? (
        <SiteButton href={props.ctaHref!} variant="accent">
          {props.ctaLabel}
        </SiteButton>
      ) : null}
      {hasCta2 ? (
        <SiteButton href={props.cta2Href!} variant="outline">
          {props.cta2Label}
        </SiteButton>
      ) : null}
    </>
  );

  /* ---------- Varian: besar tengah ---------- */
  if (variantKey === "hero.besar-tengah") {
    return (
      <Section
        tone={image ? "default" : "primary"}
        className="relative overflow-hidden"
      >
        {image ? (
          <div className="absolute inset-0" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-full w-full object-cover opacity-15" />
            {/*
              Lapisan pemudar di bawah: tanpa ini, gambar yang terang membuat
              teks judul kehilangan kontras di bagian bawah blok. Gradiennya
              memakai warna latar sekolah, bukan hitam, supaya menyatu dengan
              tema — bukan noda gelap yang terlihat asing.
            */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--site-bg)]" />
          </div>
        ) : null}

        <div className="relative mx-auto max-w-3xl text-center">
          {logoUrl ? (
            <div className="site-rise mb-[clamp(1.25rem,3vw,2rem)] flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={schoolName}
                className="h-[clamp(4rem,8vw,5.5rem)] w-[clamp(4rem,8vw,5.5rem)] object-contain"
              />
            </div>
          ) : null}

          <h1
            className="site-rise font-[family-name:var(--site-heading-font)] font-bold tracking-tight"
            style={{
              fontSize: "clamp(1.9rem, 1.1rem + 3.4vw, 3.5rem)",
              lineHeight: 1.08,
              animationDelay: "90ms",
            }}
          >
            {title}
          </h1>

          {subtitle ? (
            <p
              className="site-rise mx-auto mt-[clamp(1rem,2.5vw,1.5rem)] max-w-2xl text-[clamp(1rem,0.95rem+0.4vw,1.25rem)] leading-relaxed opacity-90"
              style={{ animationDelay: "180ms" }}
            >
              {subtitle}
            </p>
          ) : null}

          {hasCta || hasCta2 ? (
            <div
              className="site-rise mt-[clamp(1.75rem,4vw,2.5rem)] flex flex-wrap justify-center gap-3"
              style={{ animationDelay: "280ms" }}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </Section>
    );
  }

  /* ---------- Varian: belah dua ---------- */
  if (variantKey === "hero.belah-dua") {
    return (
      <Section>
        <div className="grid items-center gap-[clamp(2rem,5vw,3.5rem)] lg:grid-cols-2">
          <div>
            {logoUrl ? (
              <div className="site-rise mb-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={schoolName} className="h-14 w-14 object-contain" />
              </div>
            ) : null}

            <h1
              className="site-rise font-[family-name:var(--site-heading-font)] font-bold tracking-tight text-[var(--site-text)]"
              style={{
                fontSize: "clamp(1.75rem, 1.1rem + 2.6vw, 3rem)",
                lineHeight: 1.1,
                animationDelay: "90ms",
              }}
            >
              {title}
            </h1>

            {subtitle ? (
              <p
                className="site-rise mt-5 text-[clamp(1rem,0.95rem+0.4vw,1.125rem)] leading-relaxed text-[var(--site-muted)]"
                style={{ animationDelay: "180ms" }}
              >
                {subtitle}
              </p>
            ) : null}

            {hasCta || hasCta2 ? (
              <div
                className="site-rise mt-8 flex flex-wrap gap-3"
                style={{ animationDelay: "260ms" }}
              >
                {actions}
              </div>
            ) : null}
          </div>

          {image ? (
            <div className="site-fade" style={{ animationDelay: "160ms" }}>
              <SiteImage src={image} alt={title} ratio="4/3" />
            </div>
          ) : null}
        </div>
      </Section>
    );
  }

  /* ---------- Varian: ringkas ---------- */
  return (
    <Section tone="surface">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={schoolName} className="h-12 w-12 shrink-0 object-contain" />
          ) : null}
          <div>
            <h1
              className="font-[family-name:var(--site-heading-font)] font-bold tracking-tight text-[var(--site-text)]"
              style={{ fontSize: "clamp(1.35rem, 1.1rem + 1.2vw, 1.875rem)", lineHeight: 1.15 }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-base text-[var(--site-muted)]">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {hasCta || hasCta2 ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </Section>
  );
}
