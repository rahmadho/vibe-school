"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAYS, DAY_SHORT } from "@/lib/validations/schedule";
import { createSchedule, updateSchedule, deleteSchedule } from "./actions";
import { ScheduleDialog, FilledCell } from "./schedule-cells";

type Option = { id: string; name: string };
type Slot = {
  id: string;
  slotNumber: number;
  startTime: string;
  endTime: string;
  label: string | null;
};
type Entry = {
  id: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  dayOfWeek: number;
  timeSlotId: string;
  room: string | null;
};

/**
 * Grid jadwal: baris = jam pelajaran, kolom = hari (Senin–Sabtu).
 * Kosong = bisa diklik untuk menambah. Terisi = klik untuk ubah/hapus.
 */
export function ScheduleGrid({
  classId,
  slots,
  entries,
  subjects,
  teachers,
}: {
  classId: string;
  slots: Slot[];
  entries: Entry[];
  subjects: Option[];
  teachers: Option[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{
    day: number;
    slotId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Peta cepat: `${slotId}:${day}` → entry
  const map = new Map<string, Entry>();
  for (const e of entries) map.set(`${e.timeSlotId}:${e.dayOfWeek}`, e);

  const days = DAYS.filter((d) => d !== 7); // Senin–Sabtu (umum di Indonesia)

  function onDelete(id: string) {
    setError(null);
    void deleteSchedule(id).then((res) => {
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function onEdit(entry: Entry) {
    setError(null);
    // Ubah = buka dialog pada hari+jam yang sama, pra-isi.
    setDialog({ day: entry.dayOfWeek, slotId: entry.timeSlotId });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded border border-marker/30 bg-marker/5 px-3 py-2 text-sm text-marker">
          {error}
        </p>
      ) : null}

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
                  Belum ada jam pelajaran. Atur jam pelajaran terlebih dahulu.
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
                      <span className="mt-0.5 block font-mono text-[10px] leading-tight tabular-nums text-slate">
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

                      // Jam istirahat: tidak bisa diisi pelajaran.
                      if (isBreak) {
                        return (
                          <td
                            key={d}
                            className="border-b border-chalk bg-paper/70 px-1 py-1"
                          >
                            <div className="flex h-14 items-center justify-center text-[10px] uppercase tracking-wide text-slate-light">
                              —
                            </div>
                          </td>
                        );
                      }

                      if (entry) {
                        return (
                          <td key={d} className="border-b border-chalk p-1 align-top">
                            <FilledCell
                              entry={{
                                id: entry.id,
                                subjectName: entry.subjectName,
                                teacherName: entry.teacherName,
                                room: entry.room,
                              }}
                              onEdit={() => onEdit(entry)}
                              onDelete={() => onDelete(entry.id)}
                            />
                          </td>
                        );
                      }

                      return (
                        <td key={d} className="border-b border-chalk p-1 align-top">
                          <button
                            type="button"
                            onClick={() => setDialog({ day: d, slotId: s.id })}
                            className="flex h-14 w-full items-center justify-center rounded border border-dashed border-chalk text-slate-light transition-colors hover:border-board hover:bg-board/5 hover:text-board"
                            aria-label={`Tambah jadwal ${DAY_SHORT[d]} jam ke-${s.slotNumber}`}
                          >
                            +
                          </button>
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

      {dialog ? (
        <ScheduleDialog
          open
          classId={classId}
          dayOfWeek={dialog.day}
          timeSlotId={dialog.slotId}
          subjects={subjects}
          teachers={teachers}
          action={createSchedule}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
