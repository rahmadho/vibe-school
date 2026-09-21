import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Query layer pustaka media web sekolah.
 * Isolasi tenant: semua query menerima schoolId dari sesi.
 */

export type MediaFilter = {
  q?: string;
  /** "all" | "used" | "unused" | "large" */
  filter?: string;
  source?: string;
};

/** Berkas dianggap besar bila melewati ambang ini (byte). */
export const LARGE_FILE_BYTES = 300 * 1024;

export async function listMedia(schoolId: string, filter: MediaFilter = {}) {
  const rows = await prisma.media.findMany({
    where: {
      schoolId, // isolasi tenant
      deletedAt: null,
      ...(filter.source === "UPLOAD" || filter.source === "LINK"
        ? { source: filter.source }
        : {}),
      ...(filter.q
        ? {
            OR: [
              { name: { contains: filter.q, mode: "insensitive" } },
              { url: { contains: filter.q, mode: "insensitive" } },
              { altText: { contains: filter.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filter.filter === "large"
        ? { size: { gt: LARGE_FILE_BYTES } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  if (filter.filter !== "used" && filter.filter !== "unused") return rows;

  // "Dipakai / belum dipakai" tidak bisa dijawab SQL langsung: pemakaian
  // tersebar di kolom URL berbagai tabel. Karena jumlah berkas satu sekolah
  // kecil (puluhan), pemeriksaan di memori lebih sederhana dan tetap cepat.
  const used = await usedUrls(schoolId);
  return rows.filter((r) =>
    filter.filter === "used" ? used.has(r.url) : !used.has(r.url),
  );
}

/**
 * Kumpulan URL yang sedang dipakai di seluruh isi web sekolah.
 *
 * Daftar tabelnya sengaja eksplisit, bukan pencarian otomatis: kalau ada kolom
 * URL baru di kemudian hari, tempat ini harus ikut diperbarui — dan itu
 * kelihatan saat membaca kode, bukan tersembunyi.
 */
export async function usedUrls(schoolId: string): Promise<Set<string>> {
  const [school, posts, siteConfig, pages, blocks] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { logoUrl: true },
    }),
    prisma.post.findMany({
      where: { schoolId, deletedAt: null },
      select: { coverUrl: true, content: true },
    }),
    prisma.siteConfig.findUnique({
      where: { schoolId },
      select: { homepageMode: true },
    }),
    prisma.page.findMany({
      where: { schoolId, deletedAt: null },
      select: { content: true, blocks: true },
    }),
    prisma.siteBlock.findMany({
      where: { schoolId },
      select: { props: true },
    }),
  ]);

  const urls = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && v.length > 0) urls.add(v);
  };

  add(school?.logoUrl);
  for (const p of posts) {
    add(p.coverUrl);
    collectUrlsFromText(p.content, urls);
  }
  for (const p of pages) {
    collectUrlsFromText(p.content, urls);
    // `Page.blocks` juga memuat gambar (blok gambar, kartu, kutipan). Tanpa
    // pemindaian ini, gambar di blok dianggap "belum dipakai" lalu bisa
    // dihapus dari pustaka media — dan halaman itu kehilangan gambarnya.
    collectUrlsFromJson(p.blocks, urls);
  }
  // Blok halaman depan menyimpan gambar di dalam JSON `props`.
  for (const b of blocks) collectUrlsFromJson(b.props, urls);
  void siteConfig;

  return urls;
}

/** Ambil URL gambar dari HTML/teks bebas (mis. isi berita dari editor). */
function collectUrlsFromText(text: string, out: Set<string>): void {
  for (const m of text.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (m[1]) out.add(m[1]);
  }
}

/** Telusuri nilai JSON apa pun dan kumpulkan string yang terlihat seperti URL. */
function collectUrlsFromJson(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    if (/^(https?:\/\/|\/)/.test(value)) out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectUrlsFromJson(v, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectUrlsFromJson(v, out);
  }
}

/** Ringkasan pustaka: jumlah berkas, total ukuran, berapa yang belum dipakai. */
export async function getMediaStats(schoolId: string) {
  const rows = await prisma.media.findMany({
    where: { schoolId, deletedAt: null },
    select: { url: true, size: true, source: true },
  });

  const used = await usedUrls(schoolId);
  const uploads = rows.filter((r) => r.source === "UPLOAD");

  return {
    total: rows.length,
    uploads: uploads.length,
    links: rows.filter((r) => r.source === "LINK").length,
    unused: rows.filter((r) => !used.has(r.url)).length,
    // Ukuran hanya diketahui untuk berkas yang kita simpan sendiri; tautan luar
    // tidak diunduh, jadi tidak dihitung.
    totalBytes: uploads.reduce((a, r) => a + (r.size ?? 0), 0),
  };
}

/** Daftar URL yang dipakai + di mana — untuk panel detail. */
export async function mediaUsage(
  schoolId: string,
  url: string,
): Promise<string[]> {
  const [posts, pages, school] = await Promise.all([
    prisma.post.findMany({
      where: {
        schoolId,
        deletedAt: null,
        OR: [{ coverUrl: url }, { content: { contains: url } }],
      },
      select: { title: true },
    }),
    prisma.page.findMany({
      where: { schoolId, deletedAt: null },
      select: { title: true, content: true, blocks: true },
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, logoUrl: true },
    }),
  ]);

  const out: string[] = [];
  if (school?.logoUrl === url) out.push(`Logo ${school.name}`);
  for (const p of posts) out.push(`Berita: ${p.title}`);
  for (const p of pages) {
    // URL bisa muncul di isi teks maupun di dalam blok (gambar, kartu,
    // kutipan). Keduanya harus diperiksa agar berkas yang masih dipakai tidak
    // ditawarkan untuk dihapus.
    if (p.content.includes(url) || JSON.stringify(p.blocks).includes(url)) {
      out.push(`Halaman: ${p.title}`);
    }
  }
  return out;
}
