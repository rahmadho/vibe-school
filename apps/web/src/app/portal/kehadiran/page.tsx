import { wajibKonteksPortal } from "@/lib/portal-akses";
import { kehadiranPortal } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Label status kehadiran dalam bahasa Indonesia.
 * Nilai enum: PRESENT | LATE | SICK | EXCUSED | ABSENT
 */
const LABEL: Record<string, string> = {
  PRESENT: "Hadir",
  LATE: "Terlambat",
  SICK: "Sakit",
  EXCUSED: "Izin",
  ABSENT: "Alpa",
};

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function labelBulan(kunci: string): string {
  const [tahun, bulan] = kunci.split("-");
  const idx = Number(bulan) - 1;
  return `${NAMA_BULAN[idx] ?? bulan} ${tahun}`;
}

/** Rekap kehadiran per bulan + catatan terakhir. */
export default async function PortalKehadiranPage() {
  const { anak } = await wajibKonteksPortal();
  const { perBulan, terakhir } = await kehadiranPortal(anak.id, anak.schoolId);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Kehadiran</h1>

      {perBulan.length === 0 ? (
        <p className="text-sm text-slate">Belum ada catatan kehadiran.</p>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-chalk bg-white">
            <table className="w-full text-sm">
              <thead className="bg-chalk/40 text-left text-xs uppercase text-slate">
                <tr>
                  <th className="px-4 py-2 font-medium">Bulan</th>
                  <th className="px-2 py-2 text-center font-medium">Hadir</th>
                  <th className="px-2 py-2 text-center font-medium">Sakit</th>
                  <th className="px-2 py-2 text-center font-medium">Izin</th>
                  <th className="px-2 py-2 text-center font-medium">Alpa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk">
                {perBulan.map((b) => (
                  <tr key={b.bulan}>
                    <td className="px-4 py-2 text-ink">{labelBulan(b.bulan)}</td>
                    <td className="px-2 py-2 text-center text-ink">
                      {b.hitung.PRESENT ?? 0}
                    </td>
                    <td className="px-2 py-2 text-center text-slate">
                      {b.hitung.SICK ?? 0}
                    </td>
                    <td className="px-2 py-2 text-center text-slate">
                      {b.hitung.EXCUSED ?? 0}
                    </td>
                    <td className="px-2 py-2 text-center text-marker">
                      {b.hitung.ABSENT ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {terakhir.length > 0 && (
            <section className="rounded-xl border border-chalk bg-white p-5">
              <h2 className="font-display text-lg text-ink">Catatan terakhir</h2>
              <ul className="mt-3 divide-y divide-chalk">
                {terakhir.map((t, idx) => (
                  <li
                    key={`${t.date.toISOString()}-${idx}`}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm text-ink">{formatDate(t.date)}</span>
                    <span
                      className={
                        "text-xs " +
                        (t.status === "ABSENT"
                          ? "text-marker"
                          : t.status === "PRESENT"
                            ? "text-slate"
                            : "text-slate")
                      }
                    >
                      {LABEL[t.status] ?? t.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
