"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError } from "@/components/form-fields";
import { SUBJECT_GROUPS, SUBJECT_GROUP_LABEL } from "@/lib/validations/academic";
import type { ActionResult } from "@/lib/action-result";

/** Form mapel — create & edit (inline di halaman daftar). */
export function SubjectForm({
  mode,
  majors,
  terminology,
  initial,
  action,
  onDone,
}: {
  mode: "create" | "edit";
  majors: Array<{ id: string; code: string; name: string }>;
  terminology: string;
  initial?: {
    id?: string;
    code?: string;
    name?: string;
    kkm?: number;
    group?: string;
    majorId?: string;
  };
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

  return (
    <form onSubmit={onSubmit} className="card space-y-4" noValidate>
      <h2 className="card-title">
        {mode === "create" ? "Tambah mata pelajaran" : "Ubah mata pelajaran"}
      </h2>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Kode" htmlFor="code" error={fe("code")}>
          <Input
            id="code"
            name="code"
            defaultValue={initial?.code ?? ""}
            placeholder="MTK"
            required
            className="font-mono uppercase"
          />
        </Field>
        <Field label="Nama mapel" htmlFor="name" error={fe("name")}>
          <Input
            id="name"
            name="name"
            defaultValue={initial?.name ?? ""}
            placeholder="Matematika"
            required
          />
        </Field>
        <Field label="KKM" htmlFor="kkm" error={fe("kkm")}>
          <Input
            id="kkm"
            name="kkm"
            type="number"
            min={0}
            max={100}
            defaultValue={initial?.kkm ?? 70}
            className="tabular-nums"
          />
        </Field>
      </div>

      {/* Kelompok mapel menentukan pengelompokan di rapor. Disederhanakan
          menjadi tiga pilihan yang bermakna untuk SMA maupun SMK. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kelompok mapel" htmlFor="group" error={fe("group")}>
          <Select id="group" name="group" defaultValue={initial?.group ?? "UMUM"}>
            {SUBJECT_GROUPS.map((g) => (
              <option key={g} value={g}>
                {SUBJECT_GROUP_LABEL[g]}
              </option>
            ))}
          </Select>
        </Field>

        {majors.length > 0 ? (
          <Field
            label={`${terminology} (opsional)`}
            htmlFor="majorId"
            error={fe("majorId")}
          >
            <Select id="majorId" name="majorId" defaultValue={initial?.majorId ?? ""}>
              <option value="">Berlaku untuk semua</option>
              {majors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Batal
          </Button>
        ) : null}
      </div>
    </form>
  );
}
