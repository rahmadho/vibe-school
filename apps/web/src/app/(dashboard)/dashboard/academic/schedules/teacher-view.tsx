"use client";

import { DAYS, DAY_SHORT } from "@/lib/validations/schedule";

type Slot = {
  id: string;
  slotNumber: number;
  startTime: string;
  endTime: string;
  label: string | null;
};
type Entry = {
  id: string;
  dayOfWeek: number;
  timeSlotId: string;
  className: string;
  subjectName: string;
  room: string | null;
};

/**
 * Jadwal seorang guru (baca saja): baris = jam, kolom = hari.
 * Berisi nama kelas & mapel, sehingga terlihat beban mengajar mingguan.
 */
export function TeacherScheduleView({
  teacherName,
  slots,
  entries,
}: {
  teacherName: string;
  slots: Slot[];
  entries: Entry[];
}) {
  const map = new Map<string, Entry>();
  for (const e of entries) map.set(`${e.timeSlotId}:${e.dayOfWeek}`, e);
  const days = DAYS.filter((d) => d !== 7);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate">
        Beban mengajar <span className="font-medium text-ink">{teacherName}</span>:{" "}
        <span className="tabular-nums text-ink">{entries.length}</span> jam pelajaran
        per minggu.
      </p>

      <div className="overflow-x-auto rounded-lg border border-chalk bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-paper">
              <th className="sticky left-0 z-10 w-28 border-b border-r border-chalk bg-paper px-3 py-2 text-left text-xs font-medium text-slate">
                Jam
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className="border-b border-chalk px-2 py-2 text-center text-xs font-medium text-slate"
                >
                  {DAY_SHORT[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.length === 0 ? (
              <tr>
                <td colSpan={days.length + 1} className="px-4 py-10 text-center text-slate">
                  Belum ada jam pelajaran.
                </td>
              </tr>
            ) : (
              slots.map((s) => {
                const isBreak = Boolean(s.label);
                return (
                  <tr key={s.id} className={isBreak ? "bg-paper/70" : undefined}>
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 border-b border-r border-chalk px-3 py-2 text-left align-top ${
                        isBreak ? "bg-paper" : "bg-white"
                      }`}
                    >
                      <span className="tabular-display text-base text-ink">
                        {s.slotNumber}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-slate">
                        {s.startTime}–{s.endTime}
                      </span>
                      {s.label ? (
                        <span className="mt-0.5 block text-[10px] italic text-slate">
                          {s.label}
                        </span>
                      ) : null}
                    </th>
                    {days.map((d) => {
                      const entry = map.get(`${s.id}:${d}`);
                      return (
                        <td key={d} className="border-b border-chalk p-1 align-top">
                          {entry ? (
                            <div className="h-14 rounded border border-chalk bg-white p-2">
                              <p className="text-xs font-medium leading-snug text-ink">
                                {entry.className}
                              </p>
                              <p className="mt-0.5 text-[11px] leading-tight text-slate">
                                {entry.subjectName}
                              </p>
                            </div>
                          ) : (
                            <div className="h-14" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
