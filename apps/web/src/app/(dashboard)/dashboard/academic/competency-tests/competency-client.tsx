"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, Textarea, FormError } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import {
  COMPETENCY_RESULTS,
  COMPETENCY_RESULT_LABEL,
  type CompetencyResultValue,
} from "@/lib/validations/academic";

/**
 * Form UKK (Uji Kompetensi Keahlian) — create & edit.
 *
 * Nomor sertifikat diberi ruang tersendiri, bukan sekadar kolom catatan:
 * sertifikat UKK adalah dokumen yang dibawa lulusan SMK saat melamar kerja.
 * Kalau nomornya hilang, siswa harus mengurus ulang ke sekolah.
 */

export type StudentOption = {
  id: string;
  nis: string;
  fullName: string;
  majorId: string | null;
  class: { id: string; name: string } | null;
};

export type CompetencyFormValues = {
  id?: string;
  studentId?: string;
  academicYearId?: string;
  majorId?: string;
  examinerName?: string;
  examinerOrg?: string;
  testDate?: string;
  result?: string;
  score?: number | null;
  certificateNo?: string;
  note?: string;
};

export function CompetencyForm({
  mode,
  initial,
  students,
  years,
  majors,
  action,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: CompetencyFormValues;
  students: StudentOption[];
  years: Array<{ id: string; name: string; isActive: boolean }>;
  majors: Array<{ id: string; code: string; name: string }>;
  action: (formData: FormData) => Promise<ActionResult>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const [studentId, setStudentId] = useState(initial?.studentId ?? "");
  /**
   * Jurusan disimpan sebagai state, bukan `defaultValue`.
   *
   * `defaultValue` hanya dibaca React saat elemen pertama dipasang. Karena
   * jurusan mengikuti siswa yang dipilih (UKK menguji jurusan siswa itu
   * sendiri), nilai itu harus berubah SETELAH mount — dan `defaultValue` tidak
   * akan melakukannya, sehingga form terkirim tanpa jurusan dan ditolak
   * validasi meski layar terlihat sudah terisi.
   */
  const [majorId, setMajorId] = useState(initial?.majorId ?? "");
  const fe = (n: string) => fieldErrors[n]?.[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const form = e.currentTarget;
    const formData = new FormData(form);
    if (mode === "edit" && initial?.id) formData.set("id", initial.id);

    const res = await action(formData);
    if (res.ok) {
      if (mode === "create") form.reset();
      router.refresh();
      setPending(false);
      onDone?.();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setPending(false);
    }
  }

  const defaultYear =
    initial?.academicYearId ?? years.find((y) => y.isActive)?.id ?? years[0]?.id ?? "";

  // Jurusan mengikuti siswa terpilih: UKK menguji jurusan siswa itu sendiri.
  // Dijalankan saat onChange (bukan efek) supaya operator yang sudah memilih
  // jurusan lain tidak tiba-tiba ditimpa.
  function onStudentChange(id: string) {
    setStudentId(id);
    const s = students.find((x) => x.id === id);
    if (s?.majorId) setMajorId(s.majorId);
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <h2 className="card-title">
        {mode === "create" ? "Tambah hasil UKK" : "Ubah hasil UKK"}
      </h2>
      <FormError message={error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Siswa" htmlFor="studentId" error={fe("studentId")}>
          <Select
            id="studentId"
            name="studentId"
            value={studentId}
            onChange={(e) => onStudentChange(e.target.value)}
            required
          >
            <option value="">Pilih siswa…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
                {s.class ? ` — ${s.class.name}` : ""} ({s.nis})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Jurusan" htmlFor="majorId" error={fe("majorId")}>
          <Select
            id="majorId"
            name="majorId"
            value={majorId}
            onChange={(e) => setMajorId(e.target.value)}
            required
          >
            <option value="">Pilih jurusan…</option>
            {majors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tahun ajaran" htmlFor="academicYearId" error={fe("academicYearId")}>
          <Select
            id="academicYearId"
            name="academicYearId"
            defaultValue={defaultYear}
            required
          >
            <option value="">Pilih tahun ajaran…</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.isActive ? " (aktif)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tanggal uji" htmlFor="testDate" error={fe("testDate")}>
          <Input
            id="testDate"
            name="testDate"
            type="date"
            defaultValue={initial?.testDate ?? ""}
            required
          />
        </Field>

        <Field label="Nama penguji" htmlFor="examinerName" error={fe("examinerName")}>
          <Input
            id="examinerName"
            name="examinerName"
            defaultValue={initial?.examinerName ?? ""}
            placeholder="Budi Santoso, S.Kom."
            required
          />
        </Field>

        <Field
          label="Asal penguji (opsional)"
          htmlFor="examinerOrg"
          error={fe("examinerOrg")}
        >
          <Input
            id="examinerOrg"
            name="examinerOrg"
            defaultValue={initial?.examinerOrg ?? ""}
            placeholder="PT Telkom Indonesia / SMK Negeri 1"
          />
        </Field>

        <Field label="Hasil" htmlFor="result" error={fe("result")}>
          <Select id="result" name="result" defaultValue={initial?.result ?? "COMPETENT"}>
            {COMPETENCY_RESULTS.map((r) => (
              <option key={r} value={r}>
                {COMPETENCY_RESULT_LABEL[r as CompetencyResultValue]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nilai (opsional)" htmlFor="score" error={fe("score")}>
          <Input
            id="score"
            name="score"
            type="number"
            min={0}
            max={100}
            defaultValue={initial?.score ?? ""}
            className="tabular-nums"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="No. sertifikat (opsional)"
            htmlFor="certificateNo"
            error={fe("certificateNo")}
          >
            <Input
              id="certificateNo"
              name="certificateNo"
              defaultValue={initial?.certificateNo ?? ""}
              className="font-mono"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Catatan (opsional)" htmlFor="note" error={fe("note")}>
            <Textarea id="note" name="note" defaultValue={initial?.note ?? ""} rows={2} />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : mode === "create" ? "Simpan hasil UKK" : "Simpan perubahan"}
        </Button>
        {mode === "edit" ? (
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Batal
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** Baris tabel UKK dengan mode tampil / ubah / hapus. */
export function CompetencyRow({
  row,
  students,
  years,
  majors,
  updateAction,
  deleteAction,
}: {
  row: {
    id: string;
    studentId: string;
    academicYearId: string;
    majorId: string;
    examinerName: string;
    examinerOrg: string | null;
    testDate: string;
    result: string;
    score: number | null;
    certificateNo: string | null;
    note: string | null;
    studentName: string;
    studentNis: string;
    className: string | null;
    majorName: string;
  };
  students: StudentOption[];
  years: Array<{ id: string; name: string; isActive: boolean }>;
  majors: Array<{ id: string; code: string; name: string }>;
  updateAction: (formData: FormData) => Promise<ActionResult>;
  deleteAction: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={7} className="bg-paper/60">
          <CompetencyForm
            mode="edit"
            initial={{
              id: row.id,
              studentId: row.studentId,
              academicYearId: row.academicYearId,
              majorId: row.majorId,
              examinerName: row.examinerName,
              examinerOrg: row.examinerOrg ?? "",
              testDate: row.testDate,
              result: row.result,
              score: row.score,
              certificateNo: row.certificateNo ?? "",
              note: row.note ?? "",
            }}
            students={students}
            years={years}
            majors={majors}
            action={updateAction}
            onDone={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  function runDelete() {
    setPending(true);
    setError(null);
    void deleteAction(row.id).then((res) => {
      setPending(false);
      if (res.ok) {
        router.refresh();
        setConfirming(false);
      } else {
        setError(res.error);
      }
    });
  }

  const competent = row.result === "COMPETENT";

  return (
    <tr>
      <td>
        <span className="text-ink">{row.studentName}</span>
        <span className="ml-2 font-mono text-xs text-slate">{row.studentNis}</span>
        <p className="mt-0.5 text-xs text-slate">{row.className ?? "—"}</p>
      </td>
      <td className="text-slate">{row.majorName}</td>
      <td>
        <span className="text-ink">{row.examinerName}</span>
        {row.examinerOrg ? (
          <p className="mt-0.5 text-xs text-slate">{row.examinerOrg}</p>
        ) : null}
      </td>
      <td className="text-xs text-slate tabular-nums">{row.testDate}</td>
      <td>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${competent ? "bg-board" : "bg-marker"}`}
          />
          <span className={competent ? "text-board" : "text-marker"}>
            {COMPETENCY_RESULT_LABEL[row.result as CompetencyResultValue] ?? row.result}
          </span>
        </span>
        {row.score !== null ? (
          <p className="tabular-nums text-sm text-ink">{row.score}</p>
        ) : null}
      </td>
      <td className="font-mono text-xs text-slate">{row.certificateNo ?? "—"}</td>
      <td className="text-right">
        {confirming ? (
          <div className="flex flex-col items-end gap-1">
            {error ? <span className="text-xs text-marker">{error}</span> : null}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={runDelete}
                disabled={pending}
                className="text-xs text-marker hover:underline disabled:opacity-50"
              >
                {pending ? "Menghapus…" : "Ya, hapus"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="text-xs text-slate hover:underline"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm text-board hover:underline"
            >
              Ubah
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-sm text-slate hover:text-marker hover:underline"
            >
              Hapus
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
