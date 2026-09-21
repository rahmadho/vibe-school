import { guard } from "@/lib/action-guard";
import { listMedia, getMediaStats, mediaUsage } from "@/lib/data/media";
import { MediaLibrary, type MediaItem } from "./media-library";

/**
 * Media manager — pustaka berkas web sekolah.
 *
 * Izin memakai modul `website` — media pada dasarnya melayani web sekolah
 * (berita, banner, logo, galeri), dan menambah modul baru hanya untuk ini akan
 * memaksa setiap role diperiksa ulang tanpa manfaat.
 */
export const metadata = { title: "Media" };
export const dynamic = "force-dynamic";

/** Tanggal `DateTime` → "YYYY-MM-DD" untuk tampilan. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function MediaPage() {
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

  const { schoolId } = g.ctx;
  const [rows, stats] = await Promise.all([
    listMedia(schoolId),
    getMediaStats(schoolId),
  ]);

  // Tempat pemakaian ditanyakan per berkas. Jumlah berkas satu sekolah
  // puluhan, jadi biayanya kecil — dan hasilnya jauh lebih berguna daripada
  // sekadar penanda "dipakai / tidak".
  const items: MediaItem[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      bytes: r.size ?? 0,
      width: r.width,
      height: r.height,
      uploadedAt: isoDate(r.createdAt),
      source: r.source,
      usage: await mediaUsage(schoolId, r.url),
      altText: r.altText,
    })),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <MediaLibrary initialItems={items} stats={stats} />
    </div>
  );
}
