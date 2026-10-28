import { wajibKonteksPortal } from "@/lib/portal-akses";
import { nilaiPortal } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Nilai per mata pelajaran + daftar rapor yang sudah dihitung. */
export default async function PortalNilaiPage() {
  const { anak } = await wajibKonteksPortal();
  const { nilai, rapor } = await nilaiPortal(anak.id, anak.schoolId);

  // Rapor diunduh PER SEMESTER (satu PDF memuat semua mapel semester itu),
  // jadi semester dikumpulkan dari baris ReportCard dan dihitung jumlah
  // mapelnya. Tanpa pengelompokan ini, "Ganjil" akan muncul berkali-kali.
  const petaSemester = new Map<
    string,
    { semesterId: string; semesterName: string; jumlahMapel: number }
  >();
  for (const r of rapor) {
    const ada = petaSemester.get(r.semesterId);
    if (ada) {
      ada.jumlahMapel += 1;
    } else {
      petaSemester.set(r.semesterId, {
        semesterId: r.semesterId,
        semesterName: r.semesterName,
        jumlahMapel: 1,
      });
    }
  }
  const semesterUnik = [...petaSemester.values()].sort((a, b) =>
    a.semesterName < b.semesterName ? -1 : a.semesterName > b.semesterName ? 1 : 0,
  );

  // Kelompokkan per mapel — orang tua membaca "nilai Matematika", bukan
  // daftar komponen lepas.
  const perMapel = new Map<
    string,
    { nama: string; item: { id: string; nama: string; skor: number; tanggal: Date }[] }
  >();
  for (const n of nilai) {
    const kunci = n.subject.id;
    if (!perMapel.has(kunci)) {
      perMapel.set(kunci, { nama: n.subject.name, item: [] });
    }
    perMapel.get(kunci)!.item.push({
      id: n.id,
      nama: n.gradeItem.name,
      skor: n.score,
      tanggal: n.recordedAt,
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Nilai</h1>

      {perMapel.size === 0 ? (
        <p className="text-sm text-slate">Belum ada nilai yang tercatat.</p>
      ) : (
        <div className="space-y-4">
          {[...perMapel.entries()].map(([id, m]) => {
            // Rata-rata sederhana dari komponen yang sudah dinilai.
            const rata = Math.round(
              m.item.reduce((n, i) => n + i.skor, 0) / m.item.length,
            );
            return (
              <section
                key={id}
                className="rounded-xl border border-chalk bg-white p-5"
              >
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-lg text-ink">{m.nama}</h2>
                  <span className="font-display text-xl text-ink">{rata}</span>
                </div>
                <ul className="mt-3 divide-y divide-chalk">
                  {m.item.map((i) => (
                    <li key={i.id} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">{i.nama}</p>
                        <p className="text-xs text-slate-light">
                          {formatDate(i.tanggal)}
                        </p>
                      </div>
                      <span className="ml-4 text-sm text-slate">{i.skor}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {semesterUnik.length > 0 && (
        <section className="rounded-xl border border-chalk bg-white p-5">
          <h2 className="font-display text-lg text-ink">Rapor</h2>
          <p className="mt-1 text-xs text-slate">
            Unduh rapor resmi (PDF) berisi seluruh nilai semester tersebut.
          </p>
          <ul className="mt-3 divide-y divide-chalk">
            {semesterUnik.map((s) => (
              <li
                key={s.semesterId}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{s.semesterName}</p>
                  <p className="text-xs text-slate-light">
                    {s.jumlahMapel} mata pelajaran
                  </p>
                </div>
                {/* Unduhan membawa studentId & semesterId; route API memeriksa
                    sendiri bahwa ini memang rapor anak pemilik akun, jadi
                    menebak ID di URL tidak membuka rapor orang lain. */}
                <a
                  href={`/api/rapor/${anak.id}/${s.semesterId}`}
                  target="_blank"
                  rel="noopener"
                  className="shrink-0 rounded-lg border border-chalk px-3 py-1.5 text-xs font-medium text-board"
                >
                  Unduh rapor
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rapor.length > 0 && (
        <section className="rounded-xl border border-chalk bg-white p-5">
          <h2 className="font-display text-lg text-ink">Nilai rapor</h2>
          <p className="mt-1 text-xs text-slate">
            Nilai akhir per mata pelajaran yang sudah dihitung sekolah.
          </p>
          <ul className="mt-3 divide-y divide-chalk">
            {rapor.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{r.subjectName}</p>
                  <p className="text-xs text-slate-light">{r.semesterName}</p>
                </div>
                <span className="ml-4 font-display text-lg text-ink">
                  {r.finalScore}
                  {r.predicate ? (
                    <span className="ml-2 text-xs text-slate">{r.predicate}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
