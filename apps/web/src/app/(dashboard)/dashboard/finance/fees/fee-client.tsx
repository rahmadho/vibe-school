"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { FormError } from "@/components/form-fields";
import { formatRupiah } from "@/lib/finance-calc";
import type { ActionResult } from "@/lib/action-result";

export function FeeTypeForm({
  action,
}: {
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
    const form = e.currentTarget;
    const res = await action(new FormData(form));
    if (res.ok) {
      form.reset();
      router.refresh();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama" htmlFor="name" error={fe("name")}>
          <Input id="name" name="name" placeholder="SPP Bulanan" required />
        </Field>
        <Field label="Kode" htmlFor="code" error={fe("code")}>
          <Input
            id="code"
            name="code"
            placeholder="SPP"
            required
            className="font-mono"
          />
        </Field>
        <Field label="Nominal (Rp)" htmlFor="amount" error={fe("amount")}>
          <Input
            id="amount"
            name="amount"
            type="number"
            min={1}
            placeholder="250000"
            required
            className="tabular-nums"
          />
        </Field>
        <div className="flex items-end gap-4 pb-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="recurring"
              className="h-4 w-4 accent-[#1f4e46]"
            />
            Biaya berkala
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
              className="h-4 w-4 accent-[#1f4e46]"
            />
            Aktif
          </label>
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Tambah jenis biaya"}
      </Button>
    </form>
  );
}

export function FeeTypeRow({
  fee,
  updateAction,
}: {
  fee: {
    id: string;
    name: string;
    code: string;
    amount: number;
    recurring: boolean;
    isActive: boolean;
    invoiceCount: number;
  };
  updateAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={6} className="bg-paper/60 px-4 py-4">
          <EditFeeForm
            fee={fee}
            action={updateAction}
            onDone={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  async function toggleActive() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("id", fee.id);
    fd.set("name", fee.name);
    fd.set("code", fee.code);
    fd.set("amount", String(fee.amount));
    if (fee.recurring) fd.set("recurring", "on");
    if (!fee.isActive) fd.set("isActive", "on");
    const res = await updateAction(fd);
    if (!res.ok) setError(res.error);
    setPending(false);
  }

  return (
    <tr>
      <td className="text-ink">{fee.name}</td>
      <td className="font-mono text-xs text-slate">{fee.code}</td>
      <td className="text-right tabular-nums text-ink">
        {formatRupiah(fee.amount)}
      </td>
      <td className="text-slate">{fee.recurring ? "Ya" : "—"}</td>
      <td>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              fee.isActive ? "bg-board" : "bg-chalk"
            }`}
            aria-hidden
          />
          {fee.isActive ? "Aktif" : "Nonaktif"}
        </span>
      </td>
      <td>
        <div className="flex items-center justify-end gap-2">
          {error ? <span className="text-xs text-marker">{error}</span> : null}
          <span className="text-xs text-slate">{fee.invoiceCount} tagihan</span>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Ubah
          </Button>
          <Button variant="ghost" onClick={toggleActive} disabled={pending}>
            {fee.isActive ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function EditFeeForm({
  fee,
  action,
  onDone,
}: {
  fee: { id: string; name: string; code: string; amount: number; recurring: boolean; isActive: boolean };
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
    fd.set("id", fee.id);
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
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nama" htmlFor={`n-${fee.id}`}>
          <Input id={`n-${fee.id}`} name="name" defaultValue={fee.name} required />
        </Field>
        <Field label="Kode" htmlFor={`c-${fee.id}`}>
          <Input
            id={`c-${fee.id}`}
            name="code"
            defaultValue={fee.code}
            required
            className="font-mono"
          />
        </Field>
        <Field label="Nominal (Rp)" htmlFor={`a-${fee.id}`}>
          <Input
            id={`a-${fee.id}`}
            name="amount"
            type="number"
            min={1}
            defaultValue={fee.amount}
            required
            className="tabular-nums"
          />
        </Field>
        <div className="flex items-end gap-4 sm:col-span-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="recurring"
              defaultChecked={fee.recurring}
              className="h-4 w-4 accent-[#1f4e46]"
            />
            Biaya berkala
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={fee.isActive}
              className="h-4 w-4 accent-[#1f4e46]"
            />
            Aktif
          </label>
        </div>
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
