import Link from "next/link";
import { BlockEmpty, Section, SectionHeading, formatSiteDateTime } from "@/components/site/site-ui";
import type { PostItem } from "@/components/site/blocks/news";

/**
 * Blok "agenda" (Agenda Kegiatan) — 2 varian gaya.
 *
 * POLA WAJIB (lihat hero.tsx): pilih varian lewat `variantKey`, warna HANYA
 * dari CSS variable (--site-*), dan tampilkan `BlockEmpty` bila data kosong.
 * Server component: tanpa "use client" dan tanpa state.
 *
 * `PostItem` diimpor dari blok news — satu sumber kebenaran bentuk data,
 * sehingga data dari DB tidak perlu cast saat dikirim ke sini.
 */

export type AgendaProps = {
  heading?: string;
  itemCount?: number;
};

/** Ambil tanggal efektif agenda (jadwal terbit, jika kosong pakai waktu dibuat). */
function eventDate(post: PostItem): Date {
  return post.publishedAt ?? post.createdAt;
}

export function AgendaBlock({
  props,
  variantKey,
  posts,
}: {
  props: AgendaProps;
  variantKey: string;
  posts: PostItem[];
}) {
  const heading = props.heading?.trim() || "";
  const limit = props.itemCount && props.itemCount > 0 ? props.itemCount : 4;

  const items = posts.slice(0, limit);

  if (items.length === 0) {
    return (
      <Section>
        <SectionHeading title={heading} />
        <BlockEmpty message="Belum ada agenda" hint="Tambahkan kegiatan lewat menu Konten." />
      </Section>
    );
  }

  /* ---------- Varian: linimasa ---------- */
  if (variantKey === "agenda.linimasa") {
    return (
      <Section>
        <SectionHeading title={heading} />
        <ol className="site-stagger space-y-6">
          {items.map((post) => {
            const d = eventDate(post);
            const day = d.toLocaleDateString("id-ID", { day: "numeric" });
            const month = d.toLocaleDateString("id-ID", { month: "short" });
            return (
              <li key={post.id} className="relative flex gap-5 pl-4">
                {/* Garis vertikal penghubung antar agenda. */}
                <span
                  aria-hidden="true"
                  className="absolute left-9 top-16 h-[calc(100%-2rem)] w-px bg-[var(--site-border)]"
                />
                <div
                  className="flex h-16 w-16 shrink-0 flex-col items-center justify-center border border-[var(--site-border)] bg-[var(--site-surface)]"
                  style={{ borderRadius: "var(--site-radius-card)" }}
                >
                  <span className="font-[family-name:var(--site-heading-font)] text-xl font-bold text-[var(--site-text)]">
                    {day}
                  </span>
                  <span className="text-xs uppercase text-[var(--site-muted)]">{month}</span>
                </div>
                <Link href={`/berita/${post.slug}`} className="block pt-1 transition-opacity hover:opacity-90">
                  <h3 className="font-[family-name:var(--site-heading-font)] text-base font-bold leading-snug text-[var(--site-text)]">
                    {post.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--site-muted)]">
                    {formatSiteDateTime(d)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ol>
      </Section>
    );
  }

  /* ---------- Varian: daftar ringkas ---------- */
  return (
    <Section>
      <SectionHeading title={heading} />
      <div className="divide-y divide-[var(--site-border)]">
        {items.map((post) => (
          <Link
            key={post.id}
            href={`/berita/${post.slug}`}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4 transition-opacity hover:opacity-90"
          >
            <h3 className="font-[family-name:var(--site-heading-font)] text-base font-semibold text-[var(--site-text)]">
              {post.title}
            </h3>
            <span className="text-xs text-[var(--site-muted)]">
              {formatSiteDateTime(eventDate(post))}
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}
