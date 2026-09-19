"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { FormError, FormSuccess } from "@/components/form-fields";
import { computeFinalScore, toPredicate, belowKkm } from "@/lib/grade-calc";
import type { ActionResult } from "@/lib/action-result";

type Component = {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  weight: number;
  maxScore: number;
};
type Student = { id: string; fullName: string; nis: string | null };

/**
 * Lembar nilai per kelas & mapel.
 *
 * Bentuknya seperti daftar nilai guru: baris = siswa, kolom = komponen
 * penilaian, ditambah kolom nilai akhir berbobot. Nilai di bawah KKM ditandai
 * karena itu isyarat untuk remedial.
 */
export function GradeSheet({
  classId,
  semesterId,
  components,
  students,
  initial,
  kkm,
  action,
}: {
  classId: string;
  semesterId: string;
  components: Component[];
  students: Student[];
  /** Peta `${gradeItemId}:${studentId}` → skor */
  initial: Record<string, number>;
  kkm: number;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();

  // Nilai disimpan sebagai teks agar kolom kosong tetap kosong (bukan 0).
  const [values, setValues] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {};
    for (const c of components) {
      for (const s of students) {
        const key = `${c.id}:${s.id}`;
        const v = initial[key];
        start[key] = v === undefined ? "" : String(v);
      }
    }
    return start;
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Hitung nilai akhir per siswa secara langsung saat mengetik.
  const finals = useMemo(() => {
    return students.map((s) => {
      const scores: Record<string, number | undefined> = {};
      for (const c of components) {
        const raw = values[`${c.id}:${s.id}`];
        scores[c.id] = raw === "" ? undefined : Number(raw);
      }
      return computeFinalScore(components, { studentId: s.id, scores });
    });
  }, [students, components, values]);

  const finalByStudent = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const f of finals) m.set(f.studentId, f.finalScore);
    return m;
  }, [finals]);

  const remedialCount = finals.filter(
    (f) => f.finalScore !== null && belowKkm(f.finalScore, kkm),
  ).length;

  if (students.length === 0) {
    return (
      <p className="rounded-lg border border-chalk bg-white px-4 py-10 text-center text-slate">
        Kelas ini belum punya siswa aktif.
      </p>
    );
  }

  if (components.length === 0) {
    return (
      <p className="rounded-lg border border-chalk bg-white px-4 py-10 text-center text-slate">
        Belum ada komponen nilai untuk mapel ini. Buat komponen (UTS, Tugas, …)
        terlebih dahulu.
      </p>
    );
  }

  function setValue(componentId: string, studentId: string, v: string) {
    setValues((prev) => ({ ...prev, [`${componentId}:${studentId}`]: v }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    // Validasi ringan di sisi klien untuk umpan balik cepat; server tetap
    // memvalidasi ulang (client tidak dipercaya).
    const over: string[] = [];
    const entries = students.map((s) => {
      const scores: Record<string, number | null> = {};
      for (const c of components) {
        const raw = values[`${c.id}:${s.id}`];
        if (raw === "" || raw === undefined) {
          scores[c.id] = null;
        } else {
          const n = Number(raw);
          if (n > c.maxScore) over.push(`${s.fullName} — ${c.name}`);
          scores[c.id] = n;
        }
      }
      return { studentId: s.id, scores };
    });

    if (over.length > 0) {
      setError(`Nilai melebihi batas maksimal: ${over.slice(0, 3).join("; ")}`);
      setPending(false);
      return;
    }

    // Kirim satu permintaan per komponen (sesuai bentuk aksi saveGrades).
    for (const c of components) {
      const list = students.map((s) => ({
        studentId: s.id,
        score:
          values[`${c.id}:${s.id}`] === ""
            ? null
            : Number(values[`${c.id}:${s.id}`]),
      }));
      const fd = new FormData();
      fd.set("gradeItemId", c.id);
      fd.set("classId", classId);
      fd.set("semesterId", semesterId);
      fd.set("entries", JSON.stringify(list));

      const res = await action(fd);
      if (!res.ok) {
        setError(`${c.name}: ${res.error}`);
        setPending(false);
        return;
      }
    }

    setSuccess("Nilai tersimpan.");
    router.refresh();
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-chalk bg-white px-4 py-3 text-sm">
        <span className="text-slate">
          KKM <span className="tabular-display text-lg text-ink">{kkm}</span>
        </span>
        <span className="h-5 w-px bg-chalk" aria-hidden />
        <span className="text-slate">
          Komponen{" "}
          <span className="tabular-display text-lg text-ink">{components.length}</span>
        </span>
        <span className="h-5 w-px bg-chalk" aria-hidden />
        <span className={remedialCount > 0 ? "text-marker" : "text-slate"}>
          Di bawah KKM{" "}
          <span className="tabular-display text-lg">{remedialCount}</span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-chalk bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-paper">
              <th className="sticky left-0 z-10 w-12 border-b border-r border-chalk bg-paper px-3 py-2 text-left text-xs font-medium text-slate">
                No
              </th>
              <th className="sticky left-12 z-10 min-w-[180px] border-b border-r border-chalk bg-paper px-3 py-2 text-left text-xs font-medium text-slate">
                Nama siswa
              </th>
              {components.map((c) => (
                <th
                  key={c.id}
                  className="w-24 border-b border-chalk px-2 py-2 text-center text-xs font-medium text-slate"
                >
                  <span className="block leading-tight text-ink">{c.name}</span>
                  <span className="font-normal text-[10px] text-slate">
                    {c.typeLabel} · {c.weight}%
                  </span>
                </th>
              ))}
              <th className="w-28 border-b border-l border-chalk px-2 py-2 text-center text-xs font-medium text-slate">
                Nilai akhir
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const final = finalByStudent.get(s.id) ?? null;
              const isRemedial = final !== null && belowKkm(final, kkm);
              return (
                <tr key={s.id} className="border-b border-chalk last:border-b-0">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 tabular-nums text-slate">
                    {i + 1}
                  </td>
                  <td className="sticky left-12 z-10 min-w-[180px] bg-white px-3 py-1.5">
                    <span className="text-ink">{s.fullName}</span>
                    {s.nis ? (
                      <span className="ml-2 font-mono text-xs text-slate">{s.nis}</span>
                    ) : null}
                  </td>
                  {components.map((c) => {
                    const raw = values[`${c.id}:${s.id}`] ?? "";
                    const num = raw === "" ? null : Number(raw);
                    const low = num !== null && belowKkm(num, kkm);
                    const tooHigh = num !== null && num > c.maxScore;
                    return (
                      <td key={c.id} className="px-1.5 py-1.5 text-center">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={c.maxScore}
                          value={raw}
                          onChange={(e) => setValue(c.id, s.id, e.target.value)}
                          aria-label={`${s.fullName} — ${c.name}`}
                          className={`h-8 w-16 rounded border px-2 text-center text-sm tabular-nums focus:outline-none ${
                            tooHigh
                              ? "border-marker bg-marker/5 text-marker"
                              : low
                                ? "border-marker/40 text-marker"
                                : "border-chalk focus:border-board"
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="border-l border-chalk px-2 py-1.5 text-center">
                    {final === null ? (
                      <span className="text-slate-light">—</span>
                    ) : (
                      <span
                        className={`tabular-display text-base ${
                          isRemedial ? "text-marker" : "text-board"
                        }`}
                        title={toPredicate(final) ?? undefined}
                      >
                        {final}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan nilai"}
        </Button>
        <p className="text-xs text-slate">
          Nilai akhir dihitung sebagai rata-rata berbobot dari komponen yang
          sudah diisi.
        </p>
      </div>
    </form>
  );
}
