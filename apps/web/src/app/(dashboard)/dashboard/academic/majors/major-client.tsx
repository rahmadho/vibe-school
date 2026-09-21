"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import type { MajorTerminology } from "@/lib/major-labels";

/**
 * Form jurusan — create & edit (inline di halaman daftar).
 *
 * Istilah field mengikuti jenjang sekolah (`terminology`), karena "Peminatan"
 * di SMA dan "Kompetensi Keahlian" di SMK adalah hal yang sama secara data.
 */
export function MajorForm({
  mode,
  initial,
  teachers,
  terminology,
  action,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    code?: string;
    name?: string;
    description?: string;
    headTeacherId?: string;
    isActive?: boolean;
  };
  teachers: Array<{ id: string; fullName: string }>;
  terminology: MajorTerminology;
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
        {mode === "create" ? `Tambah ${terminology.singular}` : `Ubah ${terminology.singular}`}
      </h2>
      <FormError message={error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kode" htmlFor="code" error={fe("code")}>
          <Input
            id="code"
            name="code"
            defaultValue={initial?.code ?? ""}
            placeholder={terminology.example.split(",")[0].trim()}
            required
            className="font-mono uppercase"
          />
        </Field>
        <Field label={`Nama ${terminology.singular}`} htmlFor="name" error={fe("name")}>
          <Input
            id="name"
            name="name"
            defaultValue={initial?.name ?? ""}
            placeholder={terminology.example}
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Ketua program (opsional)"
          htmlFor="headTeacherId"
          error={fe("headTeacherId")}
        >
          <Select
            id="headTeacherId"
            name="headTeacherId"
            defaultValue={initial?.headTeacherId ?? ""}
          >
            <option value="">Belum ditentukan</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Keterangan (opsional)" htmlFor="description" error={fe("description")}>
          <Input
            id="description"
            name="description"
            defaultValue={initial?.description ?? ""}
            placeholder="Catatan singkat tentang program ini"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
          className="h-4 w-4 accent-board"
        />
        Aktif
      </label>

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
