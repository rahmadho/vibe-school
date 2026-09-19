"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { FormError, FormSuccess } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

/**
 * Form jam pelajaran (inline). Dipakai untuk tambah & ubah.
 */
export function TimeSlotForm({
  mode,
  initial,
  action,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    slotNumber?: number;
    startTime?: string;
    endTime?: string;
    label?: string;
  };
  action: (formData: FormData) => Promise<ActionResult>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const fe = (n: string) => fieldErrors[n]?.[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (mode === "edit" && initial?.id) formData.set("id", initial.id);

    const res = await action(formData);
    if (res.ok) {
      if (mode === "create") form.reset();
      router.refresh();
      setSuccess(res.message ?? "Tersimpan.");
      onDone?.();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    }
    setPending(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className={mode === "create" ? "card space-y-4" : "space-y-3"}
      noValidate
    >
      {mode === "create" ? (
        <h2 className="card-title">Tambah jam pelajaran</h2>
      ) : null}
      <FormError message={error} />
      {mode === "create" ? <FormSuccess message={success} /> : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Jam ke-" htmlFor="slotNumber" error={fe("slotNumber")}>
          <Input
            id="slotNumber"
            name="slotNumber"
            type="number"
            min={1}
            max={20}
            defaultValue={initial?.slotNumber ?? ""}
            required
            className="tabular-nums"
          />
        </Field>
        <Field label="Mulai" htmlFor="startTime" error={fe("startTime")}>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={initial?.startTime ?? ""}
            required
            className="tabular-nums"
          />
        </Field>
        <Field label="Selesai" htmlFor="endTime" error={fe("endTime")}>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue={initial?.endTime ?? ""}
            required
            className="tabular-nums"
          />
        </Field>
        <Field label="Keterangan (opsional)" htmlFor="label" error={fe("label")}>
          <Input
            id="label"
            name="label"
            defaultValue={initial?.label ?? ""}
            placeholder="Istirahat"
          />
        </Field>
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

/** Tombol "buat 8 jam standar" sekali klik. */
export function SeedDefaultsButton({
  action,
}: {
  action: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function run() {
    setPending(true);
    setError(null);
    void action().then((res) => {
      if (res.ok) router.refresh();
      else setError(res.error);
      setPending(false);
    });
  }

  return (
    <div className="space-y-2">
      <FormError message={error} />
      <Button variant="secondary" onClick={run} disabled={pending}>
        {pending ? "Membuat…" : "Buat jam standar (07:00, 45 menit × 8)"}
      </Button>
    </div>
  );
}
