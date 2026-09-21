"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, Textarea, FormError } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import {
  INTERNSHIP_STATUSES,
  INTERNSHIP_STATUS_LABEL,
  type InternshipStatusValue,
} from "@/lib/validations/academic";

/**
 * Form penempatan PKL — create & edit (inline di halaman daftar).
 *
 * "Industri" sengaja jadi field pertama dan wajib: itulah inti data PKL.
 * Pembimbing lapangan (dari industri) dipisah dari pembimbing sekolah (guru),
 * karena keduanya orang berbeda dengan peran berbeda — menyatukannya membuat
 * operator ragu harus mengisi nama siapa.
 */

export type StudentOption = {
  id: string;
  nis: string;
  fullName: string;
  majorId: string | null;
  class: { id: string; name: string } | null;
};

export type InternshipFormValues = {
  id?: string;
  studentId?: string;
  academicYearId?: string;
  teacherId?: string;
  industryName?: string;
  industryAddress?: string;
  industryPhone?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  score?: number | null;
  certificateNo?: string;
  note?: string;
};

export function InternshipForm({
  mode,
  initial,
  students,
  years,
  teachers,
  action,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: InternshipFormValues;
  students: StudentOption[];
  years: Array<{ id: string; name: string; isActive: boolean }>;
  teachers: Array<{ id: string; fullName: string }>;
  action: (formData: FormData) => Promise<ActionResult>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
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

  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <h2 className="card-title">
        {mode === "create" ? "Tambah penempatan PKL" : "Ubah data PKL"}
      </h2>
      <FormError message={error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Siswa" htmlFor="studentId" error={fe("studentId")}>
          <Select
            id="studentId"
            name="studentId"
            defaultValue={initial?.studentId ?? ""}
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

        <Field
          label="Nama industri / instansi"
          htmlFor="industryName"
          error={fe("industryName")}
        >
          <Input
            id="industryName"
            name="industryName"
            defaultValue={initial?.industryName ?? ""}
            placeholder="PT Telkom Indonesia"
            required
          />
        </Field>

        <Field
          label="Pembimbing sekolah (opsional)"
          htmlFor="teacherId"
          error={fe("teacherId")}
        >
          <Select id="teacherId" name="teacherId" defaultValue={initial?.teacherId ?? ""}>
            <option value="">Belum ditentukan</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Alamat industri (opsional)"
            htmlFor="industryAddress"
            error={fe("industryAddress")}
          >
            <Input
              id="industryAddress"
              name="industryAddress"
              defaultValue={initial?.industryAddress ?? ""}
            />
          </Field>
        </div>

        <Field
          label="Telepon industri (opsional)"
          htmlFor="industryPhone"
          error={fe("industryPhone")}
        >
          <Input
            id="industryPhone"
            name="industryPhone"
            defaultValue={initial?.industryPhone ?? ""}
            placeholder="081234567890"
            className="tabular-nums"
          />
        </Field>

        <Field
          label="Pembimbing lapangan (opsional)"
          htmlFor="supervisorName"
          error={fe("supervisorName")}
        >
          <Input
            id="supervisorName"
            name="supervisorName"
            defaultValue={initial?.supervisorName ?? ""}
          />
        </Field>

        <Field
          label="Telepon pembimbing (opsional)"
          htmlFor="supervisorPhone"
          error={fe("supervisorPhone")}
        >
          <Input
            id="supervisorPhone"
            name="supervisorPhone"
            defaultValue={initial?.supervisorPhone ?? ""}
            placeholder="081234567890"
            className="tabular-nums"
          />
        </Field>

        <Field label="Tanggal mulai" htmlFor="startDate" error={fe("startDate")}>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={initial?.startDate ?? ""}
            required
          />
        </Field>

        <Field label="Tanggal selesai" htmlFor="endDate" error={fe("endDate")}>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={initial?.endDate ?? ""}
            required
          />
        </Field>

        <Field label="Status" htmlFor="status" error={fe("status")}>
          <Select id="status" name="status" defaultValue={initial?.status ?? "PLANNED"}>
            {INTERNSHIP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INTERNSHIP_STATUS_LABEL[s as InternshipStatusValue]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nilai akhir (opsional)" htmlFor="score" error={fe("score")}>
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

        <div className="sm:col-span-2">
          <Field label="Catatan (opsional)" htmlFor="note" error={fe("note")}>
            <Textarea id="note" name="note" defaultValue={initial?.note ?? ""} rows={2} />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : mode === "create" ? "Simpan PKL" : "Simpan perubahan"}
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

/** Baris tabel PKL dengan mode tampil / ubah / hapus. */
export function InternshipRow({
  row,
  students,
  years,
  teachers,
  updateAction,
  deleteAction,
}: {
  row: {
    id: string;
    studentId: string;
    academicYearId: string;
    teacherId: string | null;
    industryName: string;
    industryAddress: string | null;
    industryPhone: string | null;
    supervisorName: string | null;
    supervisorPhone: string | null;
    startDate: string;
    endDate: string;
    status: string;
    score: number | null;
    certificateNo: string | null;
    note: string | null;
    studentName: string;
    studentNis: string;
    className: string | null;
    majorName: string | null;
    yearName: string;
    teacherName: string | null;
  };
  students: StudentOption[];
  years: Array<{ id: string; name: string; isActive: boolean }>;
  teachers: Array<{ id: string; fullName: string }>;
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
          <InternshipForm
            mode="edit"
            initial={{
              id: row.id,
              studentId: row.studentId,
              academicYearId: row.academicYearId,
              teacherId: row.teacherId ?? undefined,
              industryName: row.industryName,
              industryAddress: row.industryAddress ?? "",
              industryPhone: row.industryPhone ?? "",
              supervisorName: row.supervisorName ?? "",
              supervisorPhone: row.supervisorPhone ?? "",
              startDate: row.startDate,
              endDate: row.endDate,
              status: row.status,
              score: row.score,
              certificateNo: row.certificateNo ?? "",
              note: row.note ?? "",
            }}
            students={students}
            years={years}
            teachers={teachers}
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

  return (
    <tr>
      <td>
        <span className="text-ink">{row.studentName}</span>
        <span className="ml-2 font-mono text-xs text-slate">{row.studentNis}</span>
        <p className="mt-0.5 text-xs text-slate">
          {row.className ?? "—"}
          {row.majorName ? ` · ${row.majorName}` : ""}
        </p>
      </td>
      <td>
        <span className="text-ink">{row.industryName}</span>
        {row.supervisorName ? (
          <p className="mt-0.5 text-xs text-slate">
            Pemb. lapangan: {row.supervisorName}
          </p>
        ) : null}
      </td>
      <td className="text-xs text-slate tabular-nums">
        {row.startDate}
        <br />
        s.d. {row.endDate}
      </td>
      <td className="text-xs text-slate">{row.teacherName ?? "—"}</td>
      <td>
        <span className="text-xs text-slate">
          {INTERNSHIP_STATUS_LABEL[row.status as InternshipStatusValue] ?? row.status}
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
