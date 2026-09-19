import { guard } from "@/lib/action-guard";
import { listPages } from "@/lib/data/site";
import { PageList } from "./page-list";

/**
 * Daftar & editor halaman kustom web sekolah.
 *
 * "Halaman kustom" = halaman tambahan buatan sekolah (profil, visi-misi,
 * sambutan). Halaman depan ("/") tidak ada di sini — ia selalu disusun dari
 * blok di halaman utama Web Sekolah.
 */

export const metadata = { title: "Halaman Web" };
export const dynamic = "force-dynamic";

export default async function WebsitePagesPage() {
  const g = await guard("website", "read");
  if ("fail" in g) {
    return (
      <div className="mx-auto max-w-md border-2 border-[var(--rule)] bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">
          Tidak dapat diakses
        </p>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          {g.fail.ok ? "Tidak diizinkan." : g.fail.error}
        </p>
      </div>
    );
  }

  const pages = await listPages(g.ctx.schoolId);

  return (
    <div className="mx-auto max-w-4xl">
      <PageList
        pages={pages.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          content: p.content,
          showInNav: p.showInNav,
          isPublished: p.isPublished,
          publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
          metaTitle: p.metaTitle ?? "",
          metaDescription: p.metaDescription ?? "",
          updatedAt: p.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
