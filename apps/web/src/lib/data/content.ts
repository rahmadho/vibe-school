import "server-only";
import { prisma } from "@/lib/prisma";
import type { PostTypeValue } from "@/lib/validations/site";

/**
 * ============================================================
 * Query layer modul Konten (berita, pengumuman, agenda, galeri)
 * ============================================================
 *
 * Semua fungsi di sini menerima `schoolId` dari SESI user dan memfilternya
 * secara eksplisit — tidak ada cara masuk ke data sekolah lain (AGENTS.md #1).
 *
 * Berbeda dengan `getPublic*` di lib/data/site.ts (yang dipanggil halaman
 * publik tanpa sesi), fungsi di sini dipakai oleh DASBOR sehingga selalu
 * membawa schoolId dari konteks otentikasi.
 */

/** Filter daftar konten di dasbor. */
export type ContentListFilter = {
  type?: PostTypeValue;
  /** "draft" | "published" | "scheduled" */
  status?: "draft" | "published" | "scheduled";
  search?: string;
};

/** Daftar tulisan untuk panel pengelola (termasuk draf), terbaru lebih dulu. */
export async function listPostsForAdmin(
  schoolId: string,
  filter: ContentListFilter = {},
) {
  const now = new Date();

  // Terbit terjadwal = ditandai terbit tetapi `publishedAt` masih di masa depan.
  const statusWhere =
    filter.status === "draft"
      ? { isPublished: false }
      : filter.status === "published"
        ? {
            isPublished: true,
            OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
          }
        : filter.status === "scheduled"
          ? { isPublished: true, publishedAt: { gt: now } }
          : {};

  return prisma.post.findMany({
    where: {
      schoolId,
      deletedAt: null,
      ...(filter.type ? { type: filter.type } : {}),
      ...statusWhere,
      ...(filter.search
        ? { title: { contains: filter.search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
}

/** Satu tulisan milik sekolah ini; null bila tidak ada / sudah dihapus. */
export async function getPostForAdmin(schoolId: string, id: string) {
  return prisma.post.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
}

/**
 * Apakah slug sudah dipakai tulisan lain di sekolah ini.
 * `excludeId` dipakai saat mengubah agar tulisan tidak dianggap bentrok
 * dengan dirinya sendiri.
 */
export async function isSlugTaken(
  schoolId: string,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const found = await prisma.post.findFirst({
    where: {
      schoolId,
      slug,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(found);
}

/** Ringkasan jumlah per status untuk kartu statistik di halaman daftar. */
export async function countPostsByStatus(schoolId: string) {
  const now = new Date();
  const [total, published, draft, scheduled] = await Promise.all([
    prisma.post.count({ where: { schoolId, deletedAt: null } }),
    prisma.post.count({
      where: {
        schoolId,
        deletedAt: null,
        isPublished: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
    }),
    prisma.post.count({
      where: { schoolId, deletedAt: null, isPublished: false },
    }),
    prisma.post.count({
      where: {
        schoolId,
        deletedAt: null,
        isPublished: true,
        publishedAt: { gt: now },
      },
    }),
  ]);

  return { total, published, draft, scheduled };
}
