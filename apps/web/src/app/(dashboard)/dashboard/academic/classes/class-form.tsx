"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

/** Form kelas — create & edit. */
export function ClassForm({
  mode,
  years,
  teachers,
  initial,
  action,
}: {
  mode: "create" | "edit";
  years: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; fullName: string }>;
  initial?: {
    id?: string;
    name?: string;
    level?: number;
    capacity?: number;
    academicYearId?: string;
    homeroomTeacherId?: string;
  };
  action: (formData: FormData) => Promise<ActionResult>;
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
    const formData = new FormData(e.currentTarget);
    if (mode === "edit" && initial?.id) formData.set("id", initial.id);

    const res = await action(formData);
    if (res.ok) {
      router.push("/dashboard/academic/classes");
      router.refresh();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormError message={error} />

      <section className="card space-y-4">
        <h2 className="card-title">Data kelas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nama kelas" htmlFor="name" error={fe("name")}>
            <Input
              id="name"
              name="name"
              defaultValue={initial?.name ?? ""}
              placeholder="7A"
              required
            />
          </Field>
          <Field label="Tingkat" htmlFor="level" error={fe("level")}>
            <Input
              id="level"
              name="level"
              type="number"
              min={1}
              max={12}
              defaultValue={initial?.level ?? 7}
              required
              className="tabular-nums"
            />
          </Field>
          <Field label="Kapasitas" htmlFor="capacity" error={fe("capacity")}>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              max={100}
              defaultValue={initial?.capacity ?? 32}
              className="tabular-nums"
            />
          </Field>
          <div className="sm:col-span-3">
            <Field
              label="Tahun ajaran"
              htmlFor="academicYearId"
              error={fe("academicYearId")}
            >
              <Select
                id="academicYearId"
                name="academicYearId"
                defaultValue={initial?.academicYearId ?? ""}
                required
              >
                <option value="">Pilih tahun ajaran…</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="card-title">Wali kelas</h2>
        <Field
          label="Guru wali kelas (opsional)"
          htmlFor="homeroomTeacherId"
          error={fe("homeroomTeacherId")}
        >
          <Select
            id="homeroomTeacherId"
            name="homeroomTeacherId"
            defaultValue={initial?.homeroomTeacherId ?? ""}
          >
            <option value="">Belum ditentukan</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : mode === "create" ? "Simpan kelas" : "Simpan perubahan"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Batal
        </Button>
      </div>
    </form>
  );
}
