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
      <Section tone={image ? "default" : "primary"} className="relative overflow-hidden">
        {image ? (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover opacity-15"
              aria-hidden="true"
            />
          </div>
        ) : null}
        <div className="relative mx-auto max-w-3xl text-center">
          {logoUrl ? (
            <div className="mb-6 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={schoolName} className="h-20 w-20 object-contain" />
            </div>
          ) : null}
          <h1 className="font-[family-name:var(--site-heading-font)] text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-4 text-lg leading-relaxed opacity-90">{subtitle}</p>
          ) : null}
          {hasCta || hasCta2 ? (
            <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
          ) : null}
        </div>
      </Section>
    );
  }

  /* ---------- Varian: belah dua ---------- */
  if (variantKey === "hero.belah-dua") {
    return (
      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={schoolName} className="mb-5 h-14 w-14 object-contain" />
            ) : null}
            <h1 className="font-[family-name:var(--site-heading-font)] text-3xl font-bold tracking-tight text-[var(--site-text)] sm:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-4 text-lg leading-relaxed text-[var(--site-muted)]">{subtitle}</p>
            ) : null}
            {hasCta || hasCta2 ? (
              <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
            ) : null}
          </div>
          <SiteImage src={image} alt={title} ratio="4/3" />
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
            <h1 className="font-[family-name:var(--site-heading-font)] text-2xl font-bold tracking-tight text-[var(--site-text)] sm:text-3xl">
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
