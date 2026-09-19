"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError } from "@/components/form-fields";
import { GRADE_TYPES, GRADE_TYPE_LABEL } from "@/lib/validations/grade";
import type { ActionResult } from "@/lib/action-result";

/** Form buat komponen nilai (UTS, Tugas 1, dst). */
export function GradeItemForm({
  action,
  context,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  /** Konteks wajib yang dikirim bersama form (mapel, tahun ajaran, guru). */
  context: { subjectId: string; academicYearId: string; teacherId: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const fe = (n: string) => fieldErrors[n]?.[0];

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Tambah komponen nilai
      </Button>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const form = e.currentTarget;
    const fd = new FormData(form);
    // Sertakan konteks (tidak terlihat pengguna, tapi wajib untuk server).
    fd.set("subjectId", context.subjectId);
    fd.set("academicYearId", context.academicYearId);
    fd.set("teacherId", context.teacherId);

    const res = await action(fd);
    if (res.ok) {
      form.reset();
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    }
    setPending(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-chalk bg-white p-5"
      noValidate
    >
      <h2 className="card-title">Komponen nilai baru</h2>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="Nama" htmlFor="name" error={fe("name")}>
            <Input id="name" name="name" placeholder="UTS / Tugas 1" required />
          </Field>
        </div>
        <Field label="Jenis" htmlFor="type" error={fe("type")}>
          <Select id="type" name="type" defaultValue="QUIZ" required>
            {GRADE_TYPES.map((t) => (
              <option key={t} value={t}>
                {GRADE_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nilai maksimal" htmlFor="maxScore" error={fe("maxScore")}>
          <Input
            id="maxScore"
            name="maxScore"
            type="number"
            min={1}
            max={1000}
            defaultValue={100}
            className="tabular-nums"
          />
        </Field>
        <Field label="Bobot (%)" htmlFor="weight" error={fe("weight")}>
          <Input
            id="weight"
            name="weight"
            type="number"
            min={1}
            max={100}
            defaultValue={100}
            required
            className="tabular-nums"
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan komponen"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Batal
        </Button>
      </div>
    </form>
  );
}

/** Baris komponen dengan ubah/hapus. */
export function GradeItemRow({
  item,
  updateAction,
  deleteAction,
}: {
  item: {
    id: string;
    name: string;
    typeLabel: string;
    weight: number;
    maxScore: number;
    teacherName: string;
    gradeCount: number;
  };
  updateAction: (formData: FormData) => Promise<ActionResult>;
  deleteAction: (id: string) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function doDelete() {
    setPending(true);
    setError(null);
    void deleteAction(item.id).then((res) => {
      if (!res.ok) setError(res.error);
      setPending(false);
    });
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={6} className="bg-paper/60 px-4 py-4">
          <EditItemForm
            item={item}
            action={updateAction}
            onDone={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="text-ink">{item.name}</td>
      <td className="text-slate">{item.typeLabel}</td>
      <td className="tabular-nums text-slate">{item.weight}%</td>
      <td className="tabular-nums text-slate">{item.maxScore}</td>
      <td className="text-slate">{item.gradeCount}</td>
      <td>
        <div className="flex justify-end gap-2">
          {error ? (
            <span className="self-center text-xs text-marker">{error}</span>
          ) : null}
          {confirming ? (
            <>
              <span className="self-center text-xs text-slate">
                {item.gradeCount > 0
                  ? `Hapus + ${item.gradeCount} nilai?`
                  : "Hapus?"}
              </span>
              <Button variant="danger" onClick={doDelete} disabled={pending}>
                Ya
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                Batal
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Ubah
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(true)}>
                Hapus
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function EditItemForm({
  item,
  action,
  onDone,
}: {
  item: { id: string; name: string; weight: number; maxScore: number };
  action: (formData: FormData) => Promise<ActionResult>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", item.id);
    const res = await action(fd);
    if (res.ok) {
      router.refresh();
      onDone();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Field label="Nama" htmlFor={`name-${item.id}`}>
            <Input id={`name-${item.id}`} name="name" defaultValue={item.name} required />
          </Field>
        </div>
        <Field label="Bobot (%)" htmlFor={`weight-${item.id}`}>
          <Input
            id={`weight-${item.id}`}
            name="weight"
            type="number"
            min={1}
            max={100}
            defaultValue={item.weight}
            required
            className="tabular-nums"
          />
        </Field>
        <Field label="Maksimal" htmlFor={`max-${item.id}`}>
          <Input
            id={`max-${item.id}`}
            name="maxScore"
            type="number"
            min={1}
            max={1000}
            defaultValue={item.maxScore}
            className="tabular-nums"
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Batal
        </Button>
      </div>
    </form>
  );
}
