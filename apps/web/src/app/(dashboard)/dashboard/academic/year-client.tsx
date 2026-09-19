"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { FormError, FormSuccess } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

/**
 * Form tahun ajaran (inline, satu baris) — pola "tambah cepat".
 * Dipakai di halaman daftar tanpa pindah halaman.
 */
export function AcademicYearForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    const res = await action(new FormData(form));
    if (res.ok) {
      form.reset();
      setSuccess(res.message ?? "Tersimpan.");
      router.refresh();
      setPending(false);
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-3">
        <FormSuccess message={success} />
        <Button onClick={() => setOpen(true)}>Tambah tahun ajaran</Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-chalk bg-white p-4"
      noValidate
    >
      <h2 className="card-title">Tahun ajaran baru</h2>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate" htmlFor="name">
            Nama (contoh: 2025/2026)
          </label>
          <input
            id="name"
            name="name"
            placeholder="2025/2026"
            required
            className="h-10 w-full rounded border border-chalk px-3 text-sm tabular-nums focus:border-board focus:outline-none"
          />
          {fe("name") ? (
            <p className="mt-1 text-xs text-marker">{fe("name")}</p>
          ) : null}
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-slate"
            htmlFor="startDate"
          >
            Mulai
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="h-10 w-full rounded border border-chalk px-3 text-sm focus:border-board focus:outline-none"
          />
          {fe("startDate") ? (
            <p className="mt-1 text-xs text-marker">{fe("startDate")}</p>
          ) : null}
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-slate"
            htmlFor="endDate"
          >
            Selesai
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            className="h-10 w-full rounded border border-chalk px-3 text-sm focus:border-board focus:outline-none"
          />
          {fe("endDate") ? (
            <p className="mt-1 text-xs text-marker">{fe("endDate")}</p>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}

/** Tombol aksi baris (aktifkan / hapus) dengan konfirmasi sederhana. */
export function RowAction({
  id,
  label,
  confirm,
  variant = "ghost",
  action,
}: {
  id: string;
  label: string;
  confirm: string;
  variant?: "ghost" | "danger" | "secondary";
  action: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await action(id);
      if (res.ok) {
        router.refresh();
        setAsking(false);
      } else {
        setError(res.error);
        setAsking(false);
      }
    });
  }

  if (asking) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-slate">{confirm}</span>
        <Button variant={variant} onClick={run} disabled={pending}>
          {pending ? "…" : "Ya"}
        </Button>
        <Button variant="ghost" onClick={() => setAsking(false)} disabled={pending}>
          Batal
        </Button>
        {error ? <span className="text-xs text-marker">{error}</span> : null}
      </span>
    );
  }

  return (
    <Button variant={variant} onClick={() => setAsking(true)}>
      {label}
    </Button>
  );
}
