"use client";

import { useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { executeBulkProgression } from "../actions";
import {
  CLASS_PROGRESSION_LABEL,
  type ClassProgressionType,
} from "@/lib/validations/academic";

type ClassItem = {
  id: string;
  name: string;
  level: number;
  academicYearId: string;
  academicYear: { id: string; name: string; isActive: boolean };
  _count: { students: number };
};

type AcademicYearItem = {
  id: string;
  name: string;
  isActive: boolean;
};

type StudentItem = {
  id: string;
  nis: string;
  fullName: string;
  gender: string;
};

type StudentRowState = {
  studentId: string;
  fullName: string;
  nis: string;
  gender: string;
  result: ClassProgressionType;
  targetClassId: string;
  note: string;
};

export function ProgressionWizard({
  classes,
  academicYears,
  initialSourceClassId,
  students,
}: {
  classes: ClassItem[];
  academicYears: AcademicYearItem[];
  initialSourceClassId?: string;
  students: StudentItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const formId = useId();
  const [sourceClassId, setSourceClassId] = useState<string>(
    initialSourceClassId ?? classes[0]?.id ?? "",
  );

  const selectedSourceClass = classes.find((c) => c.id === sourceClassId);
  const sourceAcademicYearId = selectedSourceClass?.academicYearId ?? "";

  // Bawaan tahun tujuan: tahun aktif, atau tahun berikutnya
  const activeYear = academicYears.find((y) => y.isActive) ?? academicYears[0];
  const [targetYearId, setTargetYearId] = useState<string>(activeYear?.id ?? "");

  // Kelas-kelas yang berada di tahun ajaran tujuan
  // ATURAN: Tidak boleh di bawah tingkat kelas asal siswa
  const sourceLevel = selectedSourceClass?.level ?? 1;
  const targetAvailableClasses = classes.filter(
    (c) => c.academicYearId === targetYearId && c.level >= sourceLevel,
  );

  // Cari kelas rekomendasi default (tingkat naik + 1 dengan nama sama, atau tingkat sama jika tinggal)
  const nextLevel = sourceLevel + 1;
  const defaultTargetClass =
    targetAvailableClasses.find((c) => c.level === nextLevel) ??
    targetAvailableClasses.find((c) => c.level === sourceLevel) ??
    targetAvailableClasses[0];
  const [rows, setRows] = useState<Record<string, StudentRowState>>(() => {
    const map: Record<string, StudentRowState> = {};
    for (const s of students) {
      map[s.id] = {
        studentId: s.id,
        fullName: s.fullName,
        nis: s.nis,
        gender: s.gender,
        result: "NAIK",
        targetClassId: defaultTargetClass?.id ?? "",
        note: "",
      };
    }
    return map;
  });

  function handleClassChange(newClassId: string) {
    setSourceClassId(newClassId);
    setError(null);
    setSuccess(null);
    router.push(`/dashboard/academic/progression?classId=${newClassId}`);
  }

  function setAllRowsResult(result: ClassProgressionType) {
    setRows((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], result };
      }
      return next;
    });
  }

  function setAllTargetClass(targetClassId: string) {
    setRows((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id].result === "NAIK" || next[id].result === "TINGGAL") {
          next[id] = { ...next[id], targetClassId };
        }
      }
      return next;
    });
  }

  function updateRow(
    studentId: string,
    field: keyof StudentRowState,
    value: string,
  ) {
    setRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const rowList = Object.values(rows);
    if (rowList.length === 0) {
      setError("Tidak ada siswa aktif di kelas ini untuk diproses.");
      return;
    }

    // Validasi bahwa status NAIK / TINGGAL punya targetClassId
    for (const r of rowList) {
      if ((r.result === "NAIK" || r.result === "TINGGAL") && !r.targetClassId) {
        setError(
          `Siswa "${r.fullName}" berstatus ${r.result} tetapi kelas tujuan belum dipilih.`,
        );
        return;
      }
    }

    startTransition(async () => {
      const payload = {
        sourceClassId,
        sourceAcademicYearId,
        targetAcademicYearId: targetYearId,
        items: rowList.map((r) => ({
          studentId: r.studentId,
          result: r.result,
          targetClassId: r.targetClassId || undefined,
          note: r.note.trim() || undefined,
        })),
      };

      const res = await executeBulkProgression(payload);
      if (res.ok) {
        setSuccess(res.message ?? "Kenaikan kelas berhasil diproses.");
        router.refresh();
      } else {
        setError(res.error ?? "Terjadi kesalahan saat memproses kenaikan kelas.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="border-l-4 border-[var(--marker)] bg-red-50 p-4 text-sm text-red-900"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="border-l-4 border-emerald-700 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <p className="font-medium">{success}</p>
          <div className="mt-3 flex gap-3 text-xs">
            <Link
              href="/dashboard/academic/classes"
              className="font-medium text-emerald-800 underline"
            >
              Lihat daftar kelas
            </Link>
            <Link
              href="/dashboard/students"
              className="font-medium text-emerald-800 underline"
            >
              Lihat data siswa
            </Link>
          </div>
        </div>
      )}

      {/* Bagian 1: Pemilihan Kelas Asal dan Tujuan */}
      <section className="card space-y-4">
        <h2 className="card-title">1. Pilih Kelas &amp; Tahun Ajaran</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label
              htmlFor={`${formId}-sourceClass`}
              className="block text-xs font-medium text-[var(--ink)]"
            >
              Kelas asal siswa
            </label>
            <select
              id={`${formId}-sourceClass`}
              value={sourceClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="mt-1 h-10 w-full rounded border border-[var(--chalk)] bg-white px-3 text-sm text-[var(--ink)]"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.academicYear.name}) — {c._count.students} siswa
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[var(--slate)]">
              Tahun ajaran asal:{" "}
              <strong>{selectedSourceClass?.academicYear.name ?? "—"}</strong>
            </p>
          </div>

          <div>
            <label
              htmlFor={`${formId}-targetYear`}
              className="block text-xs font-medium text-[var(--ink)]"
            >
              Tahun ajaran tujuan
            </label>
            <select
              id={`${formId}-targetYear`}
              value={targetYearId}
              onChange={(e) => setTargetYearId(e.target.value)}
              className="mt-1 h-10 w-full rounded border border-[var(--chalk)] bg-white px-3 text-sm text-[var(--ink)]"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[var(--slate)]">
              Tersedia {targetAvailableClasses.length} kelas di tahun ajaran ini.
            </p>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label
              htmlFor={`${formId}-quickTarget`}
              className="block text-xs font-medium text-[var(--ink)]"
            >
              Set kelas tujuan massal
            </label>
            <div className="mt-1 flex gap-2">
              <select
                id={`${formId}-quickTarget`}
                onChange={(e) => {
                  if (e.target.value) setAllTargetClass(e.target.value);
                }}
                className="h-10 flex-1 rounded border border-[var(--chalk)] bg-white px-3 text-sm text-[var(--ink)]"
                defaultValue=""
              >
                <option value="" disabled>
                  Pilih untuk semua…
                </option>
                {targetAvailableClasses.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.name} (Tingkat {tc.level})
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[11px] text-[var(--slate)]">
              Menerapkan kelas tujuan massal (hanya kelas &ge; tingkat {sourceLevel}).
            </p>
          </div>
        </div>
      </section>

      {/* Bagian 2: Tabel Penentuan Status Siswa */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--chalk)] pb-3">
          <div>
            <h2 className="card-title">2. Daftar Siswa &amp; Keputusan</h2>
            <p className="text-xs text-[var(--slate)]">
              Total {students.length} siswa aktif di kelas{" "}
              {selectedSourceClass?.name}.
            </p>
          </div>

          {students.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[var(--slate)]">Set semua:</span>
              <button
                type="button"
                onClick={() => setAllRowsResult("NAIK")}
                className="rounded border border-[var(--chalk)] bg-white px-2.5 py-1 text-[var(--ink)] hover:bg-[var(--chalk)]/30"
              >
                Semua Naik
              </button>
              <button
                type="button"
                onClick={() => setAllRowsResult("LULUS")}
                className="rounded border border-[var(--chalk)] bg-white px-2.5 py-1 text-[var(--ink)] hover:bg-[var(--chalk)]/30"
              >
                Semua Lulus
              </button>
              <button
                type="button"
                onClick={() => setAllRowsResult("TINGGAL")}
                className="rounded border border-[var(--chalk)] bg-white px-2.5 py-1 text-[var(--ink)] hover:bg-[var(--chalk)]/30"
              >
                Semua Tinggal
              </button>
            </div>
          )}
        </div>

        {students.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--slate)]">
            Tidak ada siswa aktif yang terdaftar di kelas ini.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-12">No</th>
                    <th className="w-28">NIS</th>
                    <th>Nama Siswa</th>
                    <th className="w-40">Keputusan</th>
                    <th className="w-56">Kelas Tujuan</th>
                    <th>Catatan (opsional)</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => {
                    const row = rows[s.id] ?? {
                      studentId: s.id,
                      fullName: s.fullName,
                      nis: s.nis,
                      gender: s.gender,
                      result: "NAIK",
                      targetClassId: defaultTargetClass?.id ?? "",
                      note: "",
                    };

                    const needsTargetClass =
                      row.result === "NAIK" || row.result === "TINGGAL";

                    return (
                      <tr key={s.id}>
                        <td className="tabular-nums text-[var(--slate)]">
                          {idx + 1}
                        </td>
                        <td className="font-mono text-xs tabular-nums text-[var(--slate)]">
                          {s.nis}
                        </td>
                        <td className="font-medium text-[var(--ink)]">
                          {s.fullName}
                        </td>
                        <td>
                          <select
                            value={row.result}
                            onChange={(e) =>
                              updateRow(
                                s.id,
                                "result",
                                e.target.value as ClassProgressionType,
                              )
                            }
                            className="h-8 w-full rounded border border-[var(--chalk)] bg-white px-2 text-xs text-[var(--ink)]"
                          >
                            {(
                              Object.keys(
                                CLASS_PROGRESSION_LABEL,
                              ) as ClassProgressionType[]
                            ).map((k) => (
                              <option key={k} value={k}>
                                {CLASS_PROGRESSION_LABEL[k]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {needsTargetClass ? (
                            <select
                              value={row.targetClassId}
                              onChange={(e) =>
                                updateRow(s.id, "targetClassId", e.target.value)
                              }
                              required
                              className="h-8 w-full rounded border border-[var(--chalk)] bg-white px-2 text-xs text-[var(--ink)]"
                            >
                              <option value="">-- Pilih Kelas Tujuan --</option>
                              {targetAvailableClasses
                                .filter((tc) =>
                                  row.result === "NAIK"
                                    ? tc.level > sourceLevel
                                    : tc.level === sourceLevel,
                                )
                                .map((tc) => (
                                  <option key={tc.id} value={tc.id}>
                                    {tc.name} (Tingkat {tc.level})
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <span className="text-xs italic text-[var(--slate)]">
                              {row.result === "LULUS"
                                ? "Status diubah jadi Alumni"
                                : "Keluar dari kelas"}
                            </span>
                          )}
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.note}
                            placeholder="Catatan jika ada…"
                            onChange={(e) =>
                              updateRow(s.id, "note", e.target.value)
                            }
                            className="h-8 w-full rounded border border-[var(--chalk)] bg-white px-2 text-xs text-[var(--ink)]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--chalk)] pt-4">
              <Link href="/dashboard/academic/classes">
                <Button type="button" variant="ghost">
                  Batal
                </Button>
              </Link>
              <Button type="submit" disabled={pending}>
                {pending ? "Memproses Kenaikan…" : "Simpan Kenaikan Kelas"}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
