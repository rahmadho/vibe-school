"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { FormError, FormSuccess } from "@/components/form-fields";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_LABEL,
  ATTENDANCE_CODE,
  type AttendanceStatusValue,
} from "@/lib/validations/attendance";
import { summarizeDay } from "@/lib/attendance-summary";
import type { ActionResult } from "@/lib/action-result";

type StudentRow = { id: string; fullName: string; nis: string | null };

/**
 * Input absensi satu kelas.
 *
 * Dirancang untuk dipakai cepat di kelas: tiap siswa punya satu tombol per
 * status (H/T/S/I/A) sehingga guru bisa menekan berurutan tanpa memilih dari
 * menu. Ada tombol "semua hadir" karena itu kasus paling umum.
 */
export function AttendanceInput({
  classId,
  date,
  students,
  initial,
  action,
}: {
  classId: string;
  date: string;
  students: StudentRow[];
  initial: Record<string, AttendanceStatusValue>;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, AttendanceStatusValue>>(() => {
    const start: Record<string, AttendanceStatusValue> = {};
    for (const s of students) start[s.id] = initial[s.id] ?? "PRESENT";
    return start;
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const summary = useMemo(
    () =>
      summarizeDay(
        students.map((s) => ({ studentId: s.id, status: marks[s.id] ?? "PRESENT" })),
      ),
    [students, marks],
  );

  function setAll(status: AttendanceStatusValue) {
    const next: Record<string, AttendanceStatusValue> = {};
    for (const s of students) next[s.id] = status;
    setMarks(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const entries = students.map((s) => ({
      studentId: s.id,
      status: marks[s.id] ?? "PRESENT",
      note: notes[s.id] ?? "",
    }));

    const fd = new FormData();
    fd.set("classId", classId);
    fd.set("date", date);
    fd.set("entries", JSON.stringify(entries));

    const res = await action(fd);
    if (res.ok) {
      setSuccess(res.message ?? "Absensi tersimpan.");
      router.refresh();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  if (students.length === 0) {
    return (
      <p className="rounded-lg border border-chalk bg-white px-4 py-10 text-center text-slate">
        Kelas ini belum punya siswa aktif. Tambahkan siswa ke kelas terlebih
        dahulu.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={error} />
      <FormSuccess message={success} />

      {/* Ringkasan langsung */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-chalk bg-white px-4 py-3">
        <span className="text-sm text-slate">
          <span className="tabular-display text-lg text-ink">{summary.total}</span>{" "}
          siswa
        </span>
        <span className="h-5 w-px bg-chalk" aria-hidden />
        {ATTENDANCE_STATUSES.map((s) => (
          <span key={s} className="text-sm">
            <span className="font-mono text-xs text-slate">{ATTENDANCE_CODE[s]}</span>{" "}
            <span className="tabular-nums text-ink">{summary.counts[s]}</span>{" "}
            <span className="text-slate">{ATTENDANCE_LABEL[s]}</span>
          </span>
        ))}
        <span className="ml-auto text-sm text-slate">
          Kehadiran{" "}
          <span className="tabular-display text-lg text-board">{summary.rate}%</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setAll("PRESENT")}>
          Semua hadir
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAll("ABSENT")}>
          Semua alpa
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-chalk bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-paper">
              <th className="w-12 border-b border-chalk px-3 py-2 text-left text-xs font-medium text-slate">
                No
              </th>
              <th className="border-b border-chalk px-3 py-2 text-left text-xs font-medium text-slate">
                Nama siswa
              </th>
              <th className="w-72 border-b border-chalk px-3 py-2 text-left text-xs font-medium text-slate">
                Status
              </th>
              <th className="w-56 border-b border-chalk px-3 py-2 text-left text-xs font-medium text-slate">
                Keterangan
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const current = marks[s.id] ?? "PRESENT";
              return (
                <tr key={s.id} className="border-b border-chalk last:border-b-0">
                  <td className="px-3 py-2 tabular-nums text-slate">{i + 1}</td>
                  <td className="px-3 py-2">
                    <span className="text-ink">{s.fullName}</span>
                    {s.nis ? (
                      <span className="ml-2 font-mono text-xs text-slate">{s.nis}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="inline-flex overflow-hidden rounded border border-chalk">
                      {ATTENDANCE_STATUSES.map((st) => {
                        const active = current === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              setMarks((m) => ({ ...m, [s.id]: st }))
                            }
                            title={ATTENDANCE_LABEL[st]}
                            aria-pressed={active}
                            className={`h-8 w-10 border-r border-chalk text-xs font-medium last:border-r-0 transition-colors ${
                              active
                                ? st === "PRESENT"
                                  ? "bg-board text-white"
                                  : st === "LATE"
                                    ? "bg-marker text-white"
                                    : "bg-ink text-white"
                                : "bg-white text-slate hover:bg-paper"
                            }`}
                          >
                            {ATTENDANCE_CODE[st]}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={notes[s.id] ?? ""}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [s.id]: e.target.value }))
                      }
                      placeholder={current === "SICK" ? "Mis. demam" : "Opsional"}
                      maxLength={200}
                      className="h-8 w-full rounded border border-chalk px-2 text-sm focus:border-board focus:outline-none"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan absensi"}
        </Button>
        <p className="text-xs text-slate">
          Siswa berstatus alpa/terlambat akan diberitahukan ke orang tua melalui
          WhatsApp.
        </p>
      </div>
    </form>
  );
}
