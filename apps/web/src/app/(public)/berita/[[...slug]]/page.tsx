import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveSchoolFromRequest } from "@/lib/site-server";
import {
  listPublishedPosts,
  countPublishedPosts,
  getPostBySlug,
} from "@/lib/data/site";
import { Section, SectionHeading, SiteCard, SiteImage, BlockEmpty, RichContent, formatSiteDate } from "@/components/site/site-ui";

/**
 * Halaman berita publik.
 *
 * Dua rute memakai berkas ini:
 *   /berita            → daftar semua tulisan terbit
 *   /berita/[slug]     → satu tulisan
 *
 * Halaman publik selalu mengambil data sekolah lewat resolusi subdomain, jadi
 * sekolah A tidak mungkin menampilkan berita sekolah B.
 */

export const dynamic = "force-dynamic";

/** Jumlah tulisan per halaman pada daftar berita. */
const PER_PAGE = 9;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug: slugArr } = await params;
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") return { title: "Berita" };

  const slug = slugArr?.[0];
  if (slug) {
    const post = await getPostBySlug(ctx.school.id, slug);
    return { title: post?.title ?? "Berita" };
  }
  return { title: "Berita & Kegiatan" };
}

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug: slugArr } = await params;
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") notFound();

  const slug = slugArr?.[0];
  if (slug) return <Article schoolId={ctx.school.id} slug={slug} />;

  // Halaman daftar: paginasi 9 tulisan per halaman.
  const sp = await searchParams;
  const total = await countPublishedPosts(ctx.school.id);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // Clamp 1..totalPages: `?page=999` atau `?page=abc` tidak boleh menghasilkan
  // halaman kosong atau query skip yang aneh.
  const requested = Number(sp.page);
  const page = Number.isFinite(requested)
    ? Math.min(totalPages, Math.max(1, Math.trunc(requested)))
    : 1;

  const posts = await listPublishedPosts(ctx.school.id, {
    take: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
  });

  return (
    <Section>
      <SectionHeading
        title="Berita & Kegiatan"
        subtitle={`Kabar terbaru dari ${ctx.school.name}`}
      />

      {posts.length === 0 && (
        <BlockEmpty
          message="Belum ada berita"
          hint="Tulisan yang diterbitkan akan muncul di halaman ini."
        />
      )}

      <div className="site-stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <SiteCard key={p.id}>
            <Link href={`/berita/${p.slug}`} className="group block">
              <SiteImage src={p.coverUrl} alt={p.title} ratio="16/9" />
              <div className="p-4">
                <p className="text-xs text-[var(--site-muted)]">
                  {formatSiteDate(p.publishedAt ?? p.createdAt)}
                </p>
                <h2 className="mt-1 font-[family-name:var(--site-heading-font)] text-lg font-semibold text-[var(--site-text)]">
                  {p.title}
                </h2>
                {p.excerpt && (
                  <p className="mt-1.5 text-sm text-[var(--site-muted)]">
                    {p.excerpt.length > 130 ? `${p.excerpt.slice(0, 130)}…` : p.excerpt}
                  </p>
                )}
              </div>
            </Link>
          </SiteCard>
        ))}
      </div>

      {totalPages > 1 && (
        <NewsPagination
          page={page}
          totalPages={totalPages}
          total={total}
        />
      )}
    </Section>
  );
}

/**
 * Navigasi halaman berita.
 *
 * Dibuat lokal (bukan memakai komponen `Pagination` dashboard) karena halaman
 * publik memakai variabel tema `--site-*`, bukan palet dasbor. Memakai `Link`
 * agar perpindahan halaman tidak memuat ulang seluruh dokumen.
 */
function NewsPagination({
  page,
  totalPages,
  total,
}: {
  page: number;
  totalPages: number;
  total: number;
}) {
  const from = (page - 1) * PER_PAGE + 1;
  const to = Math.min(total, page * PER_PAGE);

  return (
    <nav
      className="mt-10 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--site-muted)]"
      aria-label="Navigasi halaman berita"
    >
      <p>
        Menampilkan {from}–{to} dari {total} berita
      </p>

      <div className="flex items-center gap-2">
        <PageLink href={`/berita?page=${page - 1}`} disabled={page <= 1}>
          ← Sebelumnya
        </PageLink>
        <span className="px-1">
          Halaman {page} / {totalPages}
        </span>
        <PageLink href={`/berita?page=${page + 1}`} disabled={page >= totalPages}>
          Berikutnya →
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded border border-[var(--site-border)] px-3 py-1.5 opacity-40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded border border-[var(--site-border)] px-3 py-1.5 text-[var(--site-text)] transition-colors hover:bg-[var(--site-surface)]"
    >
      {children}
    </Link>
  );
}

/** Satu tulisan. */
async function Article({ schoolId, slug }: { schoolId: string; slug: string }) {
  const post = await getPostBySlug(schoolId, slug);
  if (!post) notFound();

  const related = await listPublishedPosts(schoolId, { take: 4 });

  return (
    <Section>
      <article className="mx-auto max-w-3xl">
        <Link href="/berita" className="text-sm text-[var(--site-muted)] underline">
          ← Semua berita
        </Link>

        <h1 className="mt-4 font-[family-name:var(--site-heading-font)] text-3xl font-semibold text-[var(--site-text)]">
          {post.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--site-muted)]">
          {formatSiteDate(post.publishedAt ?? post.createdAt)}
        </p>

        {post.coverUrl && (
          <div className="mt-5">
            <SiteImage src={post.coverUrl} alt={post.title} ratio="16/9" zoomOnHover />
          </div>
        )}

        <div className="mt-6">
          <RichContent html={post.content} />
        </div>

      </article>

      {related.filter((r) => r.slug !== slug).length > 0 && (
        <div className="mx-auto mt-12 max-w-3xl border-t border-[var(--site-border)] pt-6">
          <h2 className="font-[family-name:var(--site-heading-font)] text-lg font-semibold text-[var(--site-text)]">
            Berita lainnya
          </h2>
          <ul className="mt-3 space-y-2">
            {related
              .filter((r) => r.slug !== slug)
              .slice(0, 3)
              .map((r) => (
                <li key={r.id}>
                  <Link href={`/berita/${r.slug}`} className="text-sm text-[var(--site-text)] underline">
                    {r.title}
                  </Link>
                  <span className="ml-2 text-xs text-[var(--site-muted)]">
                    {formatSiteDate(r.publishedAt ?? r.createdAt)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
