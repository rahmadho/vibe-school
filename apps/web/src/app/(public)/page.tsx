import { resolveSchoolFromRequest } from "@/lib/site-server";
import {
  getSiteConfig,
  getHomepageBlocks,
  fallbackHomepageBlocks,
  getSchoolCounts,
  listPeopleForSite,
  listPublishedPosts,
  getOpenBatches,
} from "@/lib/data/site";
import { BlockData, SiteBlockList } from "@/components/site/block-renderer";

/**
 * Halaman depan web sekolah.
 *
 * Menggabungkan dua hal: SUSUNAN blok (milik sekolah) dan DATA (berita, guru,
 * jalur SPMB). Susunan menentukan tampilan; data mengisinya.
 *
 * Bila sekolah belum pernah menyentuh editor, dipakai susunan bawaan supaya
 * halaman tidak kosong melompong saat pertama dibuka.
 */

// Selalu ambil data segar: berita bisa terbit kapan saja.
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  // Opsional: Next mengetik props halaman dengan `searchParams?`; bila
  // diperlakukan wajib, `tsc` menolak karena src/app/page.tsx merender
  // halaman ini tanpa prop tersebut.
  searchParams?: Promise<{ school?: string | string[] }>;
}) {
  // `?school=<slug>` diteruskan ke resolver supaya demo bisa berpindah sekolah
  // lewat satu URL tunnel (trycloudflare menolak Host kustom). Resolver sendiri
  // mematikan cadangan ini di produksi — lihat `allowDevFallback()`.
  const ctx = await resolveSchoolFromRequest(await searchParams);

  // Layout sudah menangani kasus ini; pengaman tambahan di sini.
  if (ctx.status !== "ok") return null;

  const { school } = ctx;

  // Satu putaran kueri paralel — halaman depan butuh banyak sumber data.
  const [blocks, posts, people, spmbBatches, config] = await Promise.all([
    getHomepageBlocks(school.id),
    listPublishedPosts(school.id, { take: 12 }),
    listPeopleForSite(school.id, 12),
    getOpenBatches(school.id),
    getSiteConfig(school.id),
  ]);

  // Sekolah baru: pakai susunan bawaan agar halaman tidak kosong.
  // Angka capaian ikut diisi dari DB — lihat `getSchoolCounts`.
  const resolved =
    blocks.length > 0 ? blocks : fallbackHomepageBlocks(await getSchoolCounts(school.id));

  const data: BlockData = {
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      coverUrl: p.coverUrl,
      type: p.type,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
    })),
    people,
    contact: {
      address: school.address,
      phone: school.phone,
      email: school.email,
      mapsUrl: config?.mapsUrl,
      officeHours: config?.officeHours,
      contactWa: config?.contactWa,
      facebookUrl: config?.facebookUrl,
      instagramUrl: config?.instagramUrl,
      youtubeUrl: config?.youtubeUrl,
      tiktokUrl: config?.tiktokUrl,
    },
    schoolName: school.name,
    logoUrl: school.logoUrl,
    spmbBatches: spmbBatches.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      openDate: b.openDate,
      closeDate: b.closeDate,
      paths: b.paths.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        description: p.description,
        registrationFee: p.registrationFee,
        quota: p.quota,
      })),
    })),
  };

  return <SiteBlockList blocks={resolved} data={data} />;
}
