import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveSchoolFromRequest } from "@/lib/site-server";
import { listPublishedPosts, getPostBySlug } from "@/lib/data/site";
import { Section, SectionHeading, SiteCard, SiteImage, BlockEmpty, Prose, formatSiteDate } from "@/components/site/site-ui";

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
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug: slugArr } = await params;
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") notFound();

  const slug = slugArr?.[0];
  if (slug) return <Article schoolId={ctx.school.id} slug={slug} />;

  const posts = await listPublishedPosts(ctx.school.id, { take: 40 });

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

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <SiteCard key={p.id}>
            <Link href={`/berita/${p.slug}`} className="block">
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
    </Section>
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
            <SiteImage src={post.coverUrl} alt={post.title} ratio="16/9" />
          </div>
        )}

        <div className="mt-6">
          <Prose text={post.content} />
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
