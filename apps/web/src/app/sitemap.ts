import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { listNavPages, listPublishedPosts } from "@/lib/data/site";
import { buildSchoolUrl, rootDomainConfigFromEnv } from "@/lib/site-host";

/**
 * Sitemap web sekolah.
 *
 * Berguna untuk SEO sekolah: orang tua mencari nama sekolah di Google, dan
 * sitemap membantu berita serta halaman profil mereka terindeks.
 *
 * Dibatasi pada sekolah yang sedang diakses (dari subdomain). Tidak ada sitemap
 * lintas-sekolah — itu akan membocorkan daftar pelanggan kita ke publik.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = (h.get("host") ?? "").split(":")[0].toLowerCase();
  if (!host) return [];

  const school = await prisma.school.findFirst({
    where: {
      OR: [{ slug: host }, { customDomain: host }],
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, slug: true },
  });

  // Bukan subdomain sekolah (mis. portal utama) → tidak ada sitemap sekolah.
  if (!school) return [];

  const [posts, pages] = await Promise.all([
    listPublishedPosts(school.id, { take: 200 }),
    listNavPages(school.id),
  ]);

  const base = buildSchoolUrl(school.slug, rootDomainConfigFromEnv()).replace(/\/$/, "");

  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/spmb`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/berita`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/agenda`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/galeri`, changeFrequency: "weekly", priority: 0.6 },
  ];

  for (const p of posts) {
    entries.push({
      url: `${base}/berita/${p.slug}`,
      lastModified: p.publishedAt ?? p.createdAt,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // `listNavPages` hanya memilih title/slug/navOrder (bukan updatedAt), jadi
  // sengaja tidak ada `lastModified` di sini alih-alih mengarang tanggal.
  for (const p of pages) {
    entries.push({
      url: `${base}/${p.slug}`,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  return entries;
}
