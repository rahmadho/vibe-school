import { wajibKonteksPortal } from "@/lib/portal-akses";
import { jadwalPortal } from "@/lib/data/portal";

export const dynamic = "force-dynamic";

const HARI = [
  "", // index 0 tidak dipakai (dayOfWeek 1..7)
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

/** Jadwal pelajaran kelas siswa. */
export default async function PortalJadwalPage() {
  const { anak } = await wajibKonteksPortal();
  const { jadwal, adaKelas } = await jadwalPortal(
    anak.id,
    anak.schoolId,
    anak.classId,
  );

  if (!adaKelas) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl text-ink">Jadwal pelajaran</h1>
        <p className="text-sm text-slate">
          Kamu belum ditempatkan di kelas mana pun, jadi jadwal belum tersedia.
        </p>
      </div>
    );
  }

  // Kelompokkan per hari supaya orang tua bisa membaca "hari Senin" langsung.
  const perHari = new Map<number, typeof jadwal>();
  for (const j of jadwal) {
    const list = perHari.get(j.dayOfWeek) ?? [];
    list.push(j);
    perHari.set(j.dayOfWeek, list);
  }

  const hariTerurut = [...perHari.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Jadwal pelajaran</h1>
        <p className="mt-1 text-sm text-slate">
          {[anak.className, anak.majorName].filter(Boolean).join(" · ")}
        </p>
      </div>

      {jadwal.length === 0 ? (
        <p className="text-sm text-slate">
          Jadwal untuk kelas ini belum diatur.
        </p>
      ) : (
        <div className="space-y-4">
          {hariTerurut.map((hari) => (
            <section
              key={hari}
              className="rounded-xl border border-chalk bg-white p-5"
            >
              <h2 className="font-display text-lg text-ink">
                {HARI[hari] ?? `Hari ${hari}`}
              </h2>
              <ul className="mt-3 divide-y divide-chalk">
                {perHari.get(hari)!.map((j) => (
                  <li key={j.id} className="flex items-start justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">
                        {j.subject.name}
                      </p>
                      <p className="text-xs text-slate-light">
                        {j.teacher.fullName}
                        {j.room ? ` · ${j.room}` : ""}
                      </p>
                    </div>
                    <span className="ml-4 shrink-0 text-xs text-slate">
                      {j.timeSlot
                        ? j.timeSlot.label ??
                          `${j.timeSlot.startTime}–${j.timeSlot.endTime}`
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
