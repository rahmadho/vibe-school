import {
  BlockEmpty,
  Prose,
  Section,
  SectionHeading,
  SiteImage,
} from "@/components/site/site-ui";

/**
 * Blok "profile" (Profil Sekolah) — 3 varian gaya.
 *
 * APA: menampilkan sejarah, visi, atau keunggulan sekolah dalam teks panjang,
 * opsional dengan satu gambar pendukung.
 * KENAPA memakai <Prose>: teks dari editor berisi paragraf dan baris kosong;
 * Prose-lah yang merapikannya. Posisi gambar mengikuti `imagePosition` karena
 * sekolah kadang ingin foto di kiri, kanan, atau di bawah teks.
 */

export type ProfileProps = {
  heading?: string;
  body?: string;
  imageUrl?: string;
  imagePosition?: "kanan" | "kiri" | "bawah";
};

export function ProfileBlock({
  props,
  variantKey,
}: {
  props: ProfileProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() || "";
  const body = props.body?.trim() || "";
  const image = props.imageUrl?.trim() || "";
  const position = props.imagePosition ?? "kanan";

  // Butuh minimal judul atau isi; kalau keduanya kosong tidak ada yang dibaca.
  if (!heading && !body) {
    return (
      <Section>
        <BlockEmpty
          message="Profil sekolah belum diisi"
          hint="Tulis sejarah, visi, atau keunggulan sekolah."
        />
      </Section>
    );
  }

  /* ---------- Varian: teks + gambar (grid 2 kolom) ---------- */
  if (variantKey === "profile.teks-gambar") {
    // Gambar di bawah = teks penuh dulu, lalu gambar selebar bagian.
    if (position === "bawah") {
      return (
        <Section>
          <SectionHeading title={heading || undefined} />
          {body ? <Prose text={body} /> : null}
          {image ? (
            <SiteImage src={image} alt={heading || "Profil sekolah"} ratio="4/3" className="mt-8" />
          ) : null}
        </Section>
      );
    }

    // Gambar di kiri: pakai orden agar di desktop gambar tampil lebih dulu,
    // sementara di mobile teks tetap di atas (lebih enak dibaca).
    const imageFirst = position === "kiri";

    return (
      <Section>
        <SectionHeading title={heading || undefined} />
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className={imageFirst ? "lg:order-2" : "lg:order-1"}>
            {body ? <Prose text={body} /> : null}
          </div>
          <div className={imageFirst ? "lg:order-1" : "lg:order-2"}>
            <SiteImage src={image} alt={heading || "Profil sekolah"} ratio="4/3" zoomOnHover />
          </div>
        </div>
      </Section>
    );
  }

  /* ---------- Varian: dua kolom (teks saja, tanpa gambar) ---------- */
  if (variantKey === "profile.dua-kolom") {
    return (
      <Section tone="surface">
        <SectionHeading title={heading || undefined} />
        {/* columns-2 memecah teks panjang jadi dua alur vertikal yang nyaman dibaca. */}
        <div className="lg:columns-2 lg:gap-10">
          {body ? <Prose text={body} /> : null}
        </div>
      </Section>
    );
  }

  /* ---------- Varian: akordeon (judul membuka isi) ---------- */
  return (
    <Section>
      <details className="group border border-[var(--site-border)] bg-[var(--site-surface)] px-5 py-4" style={{ borderRadius: "var(--site-radius-card)" }}>
        <summary className="cursor-pointer list-none font-[family-name:var(--site-heading-font)] text-xl font-bold text-[var(--site-text)] sm:text-2xl">
          {heading || "Profil Sekolah"}
        </summary>
        {body ? (
          <div className="mt-4">
            <Prose text={body} />
          </div>
        ) : null}
      </details>
    </Section>
  );
}
