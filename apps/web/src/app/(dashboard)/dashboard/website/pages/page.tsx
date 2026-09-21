import { guard } from "@/lib/action-guard";
import { listPages } from "@/lib/data/site";
import { listMedia } from "@/lib/data/media";
import { parseStoredPageBlocks } from "@/lib/validations/page-blocks";
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
      <div className="mx-auto max-w-md border-2 border-[var(--chalk)] bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">
          Tidak dapat diakses
        </p>
        <p className="mt-2 text-sm text-[var(--slate)]">
          {g.fail.ok ? "Tidak diizinkan." : g.fail.error}
        </p>
      </div>
    );
  }

  // Pustaka media untuk pemilih gambar di dalam blok (blok gambar, kartu,
  // kutipan). Hanya kolom yang dipakai yang dikirim — objek Prisma utuh akan
  // membawa kolom internal ke HTML tanpa alasan.
  const [pages, media] = await Promise.all([
    listPages(g.ctx.schoolId),
    listMedia(g.ctx.schoolId),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageList
        media={media.map((m) => ({
          id: m.id,
          name: m.name,
          url: m.url,
          width: m.width,
          height: m.height,
        }))}
        pages={pages.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          content: p.content,
          // Susunan blok divalidasi ulang saat dibaca: data bisa berasal dari
          // versi aplikasi lama atau suntingan langsung di database.
          blocks: parseStoredPageBlocks(p.blocks).map((b) => ({
            id: b.id,
            blockKey: b.blockKey,
            variantKey: b.variantKey,
            order: b.order,
            isEnabled: b.isEnabled,
            props: b.props,
          })),
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
