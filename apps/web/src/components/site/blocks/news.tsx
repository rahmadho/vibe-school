import Link from "next/link";
import { BlockEmpty, Section, SectionHeading, SiteCard, SiteImage, formatSiteDate } from "@/components/site/site-ui";

/**
 * Blok "news" (Berita & Kegiatan) — 4 varian gaya.
 *
 * POLA WAJIB (lihat hero.tsx):
 *  1. Terima `props` bertipe sudah divalidasi + `variantKey`.
 *  2. Pilih varian lewat `variantKey`, JANGAN lewat prop terpisah.
 *  3. Warna HANYA dari CSS variable (--site-*), tidak pernah warna Tailwind tetap.
 *  4. Bila data kurang, tampilkan `BlockEmpty` — jangan render kosong.
 *  5. Return satu elemen pembungkus.
 *
 * Server component: tanpa "use client", tanpa state. Korsel memakai CSS overflow.
 */

/**
 * Satu tulisan dari tabel Post.
 *
 * `PostItem` didefinisikan HANYA di sini lalu diimpor blok agenda & galeri
 * (dan di-export ulang oleh block-renderer). Kalau tiap blok mendeklarasikan
 * versinya sendiri, perbedaan kecil (mis. `excerpt` boleh `undefined` vs
 * `null`) membuat data dari DB tidak bisa dikirim ke komponen tanpa cast
 * paksa. Field boleh `undefined` karena data DB memang bisa kosong.
 */
export type PostItem = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  type: "NEWS" | "ANNOUNCEMENT" | "AGENDA" | "GALLERY";
  publishedAt?: Date | null;
  createdAt: Date;
};

export type NewsProps = {
  heading?: string;
  subtitle?: string;
  itemCount?: number;
};

/** Potong teks pengantar agar kartu tidak pernah memanjang tak terkendali. */
function clip(text: string | null | undefined, max = 120): string {
  if (!text) return "";
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

export function NewsBlock({
  props,
  variantKey,
  posts,
}: {
  props: NewsProps;
  variantKey: string;
  posts: PostItem[];
}) {
  const heading = props.heading?.trim() || "";
  const subtitle = props.subtitle?.trim() || "";
  const limit = props.itemCount && props.itemCount > 0 ? props.itemCount : 3;

  // Ambil hanya item yang diminta, maksimal sebanyak `itemCount`.
  const items = posts.slice(0, limit);

  if (items.length === 0) {
    return (
      <Section>
        <SectionHeading title={heading} subtitle={subtitle} />
        <BlockEmpty
          message="Belum ada berita"
          hint="Tulisan yang diterbitkan akan muncul di sini."
        />
      </Section>
    );
  }

  /* ---------- Varian: kartu-kolom ---------- */
  if (variantKey === "news.kartu-kolom") {
    return (
      <Section>
        <SectionHeading title={heading} subtitle={subtitle} />
        <div className="site-stagger grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((post) => (
            <Link key={post.id} href={`/berita/${post.slug}`} className="group block">
              <SiteCard className="h-full overflow-hidden">
                <SiteImage src={post.coverUrl} alt={post.title} ratio="16/9" zoomOnHover />
                <div className="p-5">
                  <h3 className="font-[family-name:var(--site-heading-font)] text-lg font-bold leading-snug text-[var(--site-text)]">
                    {post.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--site-muted)]">
                    {formatSiteDate(post.publishedAt ?? post.createdAt)}
                  </p>
                  {clip(post.excerpt) ? (
                    <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted)]">
                      {clip(post.excerpt)}
                    </p>
                  ) : null}
                </div>
              </SiteCard>
            </Link>
          ))}
        </div>
      </Section>
    );
  }

  /* ---------- Varian: daftar vertikal ---------- */
  if (variantKey === "news.daftar") {
    return (
      <Section>
        <SectionHeading title={heading} subtitle={subtitle} />
        <div className="divide-y divide-[var(--site-border)]">
          {items.map((post) => (
            <Link
              key={post.id}
              href={`/berita/${post.slug}`}
              className="flex gap-4 py-5 transition-opacity hover:opacity-90"
            >
              <div className="w-24 shrink-0">
                <SiteImage src={post.coverUrl} alt={post.title} ratio="1/1" />
              </div>
              <div className="min-w-0">
                <h3 className="font-[family-name:var(--site-heading-font)] text-base font-bold leading-snug text-[var(--site-text)]">
                  {post.title}
                </h3>
                <p className="mt-1 text-xs text-[var(--site-muted)]">
                  {formatSiteDate(post.publishedAt ?? post.createdAt)}
                </p>
                {clip(post.excerpt) ? (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--site-muted)]">
                    {clip(post.excerpt)}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </Section>
    );
  }

  /* ---------- Varian: korsel (CSS overflow, tanpa JavaScript) ---------- */
  if (variantKey === "news.korsel") {
    return (
      <Section>
        <SectionHeading title={heading} subtitle={subtitle} />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {items.map((post) => (
            <Link
              key={post.id}
              href={`/berita/${post.slug}`}
              className="group block w-80 shrink-0 min-w-[280px]"
            >
              <SiteCard className="h-full overflow-hidden">
                <SiteImage src={post.coverUrl} alt={post.title} ratio="16/9" zoomOnHover />
                <div className="p-5">
                  <h3 className="font-[family-name:var(--site-heading-font)] text-base font-bold leading-snug text-[var(--site-text)]">
                    {post.title}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--site-muted)]">
                    {formatSiteDate(post.publishedAt ?? post.createdAt)}
                  </p>
                </div>
              </SiteCard>
            </Link>
          ))}
        </div>
        {items.length > 3 ? (
          <p className="mt-3 text-xs text-[var(--site-muted)]">
            Geser untuk melihat lainnya
          </p>
        ) : null}
      </Section>
    );
  }

  /* ---------- Varian: sorotan + daftar ---------- */
  const [lead, ...rest] = items;
  return (
    <Section>
      <SectionHeading title={heading} subtitle={subtitle} />
      <div className="grid gap-8 lg:grid-cols-2">
        <Link href={`/berita/${lead.slug}`} className="group block">
          <SiteImage src={lead.coverUrl} alt={lead.title} ratio="16/9" />
          <h3 className="mt-4 font-[family-name:var(--site-heading-font)] text-2xl font-bold leading-snug text-[var(--site-text)]">
            {lead.title}
          </h3>
          <p className="mt-1 text-xs text-[var(--site-muted)]">
            {formatSiteDate(lead.publishedAt ?? lead.createdAt)}
          </p>
          {clip(lead.excerpt) ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted)]">
              {clip(lead.excerpt)}
            </p>
          ) : null}
        </Link>

        {rest.length > 0 ? (
          <div className="divide-y divide-[var(--site-border)]">
            {rest.map((post) => (
              <Link
                key={post.id}
                href={`/berita/${post.slug}`}
                className="block py-4 transition-opacity hover:opacity-90"
              >
                <h4 className="font-[family-name:var(--site-heading-font)] text-base font-semibold leading-snug text-[var(--site-text)]">
                  {post.title}
                </h4>
                <p className="mt-1 text-xs text-[var(--site-muted)]">
                  {formatSiteDate(post.publishedAt ?? post.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </Section>
  );
}
