import { Section, SectionHeading, SiteImage } from "@/components/site/site-ui";
import { RichContent } from "@/components/site/site-ui";

/**
 * Blok teks — paragraf bebas dengan format.
 *
 * ============================================================
 * KENAPA MEMAKAI RichContent, BUKAN Prose
 * ============================================================
 * `Prose` memecah teks polos per baris kosong. Isi blok ini berasal dari
 * editor teks kaya (HTML), jadi ia harus melewati `RichContent` yang
 * membersihkan HTML sekaligus tetap menampilkan tulisan lama berbentuk teks
 * polos dengan benar.
 */

export type RichTextProps = {
  heading?: string;
  body?: string;
};

export function RichTextBlock({
  props,
  variantKey,
}: {
  props: RichTextProps;
  variantKey: string;
}) {
  const body = props.body?.trim() ?? "";
  const heading = props.heading?.trim() ?? "";

  if (!heading && !body) {
    return (
      <Section>
        <p className="text-sm italic text-[var(--site-muted)]">
          Blok teks masih kosong.
        </p>
      </Section>
    );
  }

  // Varian "sempit": kolom lebih pendek di tengah — nyaman dibaca untuk
  // tulisan panjang seperti sambutan, dan memberi napas pada halaman.
  const narrow = variantKey === "richtext.sempit";

  return (
    <Section>
      <div className={narrow ? "mx-auto max-w-2xl" : "max-w-3xl"}>
        {heading ? (
          <h2
            className="font-display text-[var(--site-text)]"
            style={{ fontSize: "clamp(1.5rem, 1.1rem + 1.6vw, 2.1rem)" }}
          >
            {heading}
          </h2>
        ) : null}
        {body ? (
          <div className={heading ? "mt-4" : undefined}>
            <RichContent html={body} />
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/* ============================================================
 * GAMBAR
 * ============================================================ */

export type ImageProps = {
  imageUrl?: string;
  alt?: string;
  caption?: string;
};

export function ImageBlock({
  props,
  variantKey,
}: {
  props: ImageProps;
  variantKey: string;
}) {
  const url = props.imageUrl?.trim() ?? "";
  if (!url) {
    return (
      <Section>
        <p className="text-sm italic text-[var(--site-muted)]">
          Blok gambar belum diisi.
        </p>
      </Section>
    );
  }

  const caption = props.caption?.trim();

  // Tiga varian lebar. "kiri" sengaja tidak memakai float: pada layar sempit
  // float membuat teks membungkus aneh, dan halaman sekolah banyak dibuka dari
  // ponsel.
  const wrapClass =
    variantKey === "image.tengah"
      ? "mx-auto max-w-2xl"
      : variantKey === "image.kiri"
        ? "mr-auto max-w-xl"
        : "w-full";

  return (
    <Section>
      <figure className={wrapClass}>
        <SiteImage
          src={url}
          alt={props.alt?.trim() || caption || "Gambar sekolah"}
          ratio="16/9"
        />
        {caption ? (
          <figcaption className="mt-2 text-sm text-[var(--site-muted)]">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    </Section>
  );
}

/* ============================================================
 * PEMISAH BAGIAN
 * ============================================================ */

export type SectionProps = {
  heading?: string;
  subheading?: string;
};

export function SectionBlock({
  props,
  variantKey,
}: {
  props: SectionProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() ?? "";
  const subheading = props.subheading?.trim() ?? "";
  if (!heading && !subheading) return null;

  if (variantKey === "section.tengah") {
    return (
      <Section>
        <SectionHeading title={heading} subtitle={subheading} align="center" />
      </Section>
    );
  }

  if (variantKey === "section.nomor") {
    // Nomor bagian diambil dari angka yang sudah diketik operator pada judul
    // ("2. Fasilitas"). Bila tidak ada, blok tetap tampil tanpa nomor —
    // menebak nomor urut dari posisi blok akan salah begitu blok digeser.
    const m = heading.match(/^(\d+)[.)]\s*(.*)$/);
    if (!m) return <SectionBlock props={props} variantKey="section.garis-bawah" />;

    return (
      <Section>
        <div className="flex items-baseline gap-5">
          <span
            className="tabular-display shrink-0 text-[var(--site-accent)]"
            style={{ fontSize: "clamp(2rem, 1.4rem + 2.4vw, 3rem)" }}
          >
            {m[1]}
          </span>
          <div>
            <h2 className="font-display text-[var(--site-text)] text-2xl">{m[2]}</h2>
            {subheading ? (
              <p className="mt-1 text-[var(--site-muted)]">{subheading}</p>
            ) : null}
          </div>
        </div>
      </Section>
    );
  }

  // Bawaan: garis tipis di bawah judul.
  return (
    <Section>
      <div className="border-b border-[var(--site-border)] pb-3">
        <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        {subheading ? (
          <p className="mt-1 text-[var(--site-muted)]">{subheading}</p>
        ) : null}
      </div>
    </Section>
  );
}

/* ============================================================
 * GARIS PEMISAH
 * ============================================================ */

export type DividerProps = {
  label?: string;
};

export function DividerBlock({
  props,
  variantKey,
}: {
  props: DividerProps;
  variantKey: string;
}) {
  if (variantKey === "divider.titik") {
    return (
      <Section>
        <p
          aria-hidden
          className="text-center text-lg tracking-[0.6em] text-[var(--site-border)]"
        >
          •••
        </p>
      </Section>
    );
  }

  if (variantKey === "divider.label") {
    const label = props.label?.trim();
    if (!label) {
      return (
        <Section>
          <hr className="border-t border-[var(--site-border)]" />
        </Section>
      );
    }
    return (
      <Section>
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-[var(--site-border)]" />
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--site-muted)]">
            {label}
          </span>
          <span className="h-px flex-1 bg-[var(--site-border)]" />
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <hr className="border-t border-[var(--site-border)]" />
    </Section>
  );
}
