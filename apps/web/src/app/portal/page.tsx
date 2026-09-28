import Link from "next/link";
import { wajibKonteksPortal } from "@/lib/portal-akses";
import { ringkasanPortal } from "@/lib/data/portal";
import { formatRupiah, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Beranda portal — ringkasan yang paling sering dicari orang tua:
 * tagihan belum lunas, kehadiran bulan ini, dan nilai terbaru.
 *
 * Urutan ini disengaja: masalah keuangan & absensi lebih mendesak daripada
 * daftar nilai.
 */
export default async function PortalBerandaPage() {
  // wajibKonteksPortal() mengalihkan bila pemakai bukan siswa/wali, atau
  // mengembalikan anak milik SESI (bukan dari URL).
  const { anak, peran } = await wajibKonteksPortal();
  const ringkas = await ringkasanPortal(anak.id, anak.schoolId);

  const persenHadir =
    ringkas.kehadiran.total > 0
      ? Math.round((ringkas.kehadiran.hadir / ringkas.kehadiran.total) * 100)
      : null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate">
        Selamat datang{peran === "PARENT" ? ", Bapak/Ibu" : ""}. Berikut ringkasan
        {" "}
        <span className="font-medium text-ink">{anak.fullName}</span>.
      </p>

      {/* Kartu tagihan — paling mendesak, jadi paling atas. */}
      <section className="rounded-xl border border-chalk bg-white p-5">
        <h2 className="font-display text-lg text-ink">Tagihan belum lunas</h2>
        {ringkas.totalTagihan > 0 ? (
          <>
            <p className="mt-2 font-display text-3xl text-marker">
              {formatRupiah(ringkas.totalTagihan)}
            </p>
            <p className="mt-1 text-xs text-slate">
              {ringkas.tagihanBelumLunas.length} tagihan menunggu pembayaran
            </p>
            <Link
              href="/portal/tagihan"
              className="mt-3 inline-block text-sm font-medium text-board underline"
            >
              Lihat rincian tagihan
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate">
            Tidak ada tagihan yang menunggu. Terima kasih.
          </p>
        )}
      </section>

      {/* Kehadiran bulan ini */}
      <section className="rounded-xl border border-chalk bg-white p-5">
        <h2 className="font-display text-lg text-ink">Kehadiran bulan ini</h2>
        {persenHadir === null ? (
          <p className="mt-2 text-sm text-slate">Belum ada catatan kehadiran.</p>
        ) : (
          <>
            <p className="mt-2 font-display text-3xl text-ink">{persenHadir}%</p>
            <p className="mt-1 text-xs text-slate">
              Hadir {ringkas.kehadiran.hadir} dari {ringkas.kehadiran.total} hari
              tercatat
            </p>
            <Link
              href="/portal/kehadiran"
              className="mt-3 inline-block text-sm font-medium text-board underline"
            >
              Lihat rekap kehadiran
            </Link>
          </>
        )}
      </section>

      {/* Nilai terbaru */}
      <section className="rounded-xl border border-chalk bg-white p-5">
        <h2 className="font-display text-lg text-ink">Nilai terbaru</h2>
        {ringkas.nilaiTerakhir.length === 0 ? (
          <p className="mt-2 text-sm text-slate">Belum ada nilai yang masuk.</p>
        ) : (
          <ul className="mt-3 divide-y divide-chalk">
            {ringkas.nilaiTerakhir.map((n) => (
              <li key={n.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{n.subject.name}</p>
                  <p className="text-xs text-slate-light">{n.gradeItem.name}</p>
                </div>
                <span className="ml-4 font-display text-lg text-ink">{n.score}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/portal/nilai"
          className="mt-3 inline-block text-sm font-medium text-board underline"
        >
          Lihat semua nilai
        </Link>
      </section>

      {/* Pengumuman */}
      {ringkas.pengumuman.length > 0 && (
        <section className="rounded-xl border border-chalk bg-white p-5">
          <h2 className="font-display text-lg text-ink">Pengumuman terbaru</h2>
          <ul className="mt-3 space-y-3">
            {ringkas.pengumuman.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/portal/pengumuman`}
                  className="text-sm text-ink hover:underline"
                >
                  {p.title}
                </Link>
                {p.publishedAt && (
                  <p className="text-xs text-slate-light">
                    {formatDate(p.publishedAt)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
