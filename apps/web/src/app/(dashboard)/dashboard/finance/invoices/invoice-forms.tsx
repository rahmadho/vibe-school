"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError, FormSuccess } from "@/components/form-fields";
import { formatRupiah } from "@/lib/finance-calc";
import type { ActionResult } from "@/lib/action-result";

type Student = { id: string; fullName: string; nis: string | null; classId: string | null };
type FeeType = { id: string; name: string; amount: number; code: string };

type Row = { key: string; feeTypeId: string; description: string; amount: string; quantity: string };

function newRow(f: FeeType | undefined, idx: number): Row {
  return {
    key: `r${idx}-${Date.now()}`,
    feeTypeId: f?.id ?? "",
    description: f?.name ?? "",
    amount: f ? String(f.amount) : "",
    quantity: "1",
  };
}

/** Form buat tagihan untuk satu siswa (dengan rincian biaya). */
export function InvoiceForm({
  students,
  feeTypes,
  action,
}: {
  students: Student[];
  feeTypes: FeeType[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => [newRow(feeTypes[0], 0)]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const fe = (n: string) => fieldErrors[n]?.[0];

  const total = useMemo(
    () =>
      rows.reduce((a, r) => {
        const amt = Number(r.amount) || 0;
        const qty = Number(r.quantity) || 0;
        return a + amt * qty;
      }, 0),
    [rows],
  );

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function onPickFee(key: string, feeTypeId: string) {
    const f = feeTypes.find((x) => x.id === feeTypeId);
    updateRow(key, {
      feeTypeId,
      description: f?.name ?? "",
      amount: f ? String(f.amount) : "",
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);
    fd.set(
      "items",
      JSON.stringify(
        rows.map((r) => ({
          feeTypeId: r.feeTypeId || undefined,
          description: r.description,
          amount: r.amount,
          quantity: r.quantity || "1",
        })),
      ),
    );

    const res = await action(fd);
    if (res.ok) {
      setSuccess(res.message ?? "Tagihan dibuat.");
      router.push("/dashboard/finance/invoices");
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="grid gap-4 rounded-lg border border-chalk bg-white p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Siswa" htmlFor="studentId" error={fe("studentId")}>
            <Select id="studentId" name="studentId" required defaultValue="">
              <option value="" disabled>
                Pilih siswa…
              </option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                  {s.nis ? ` — ${s.nis}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Judul tagihan" htmlFor="title" error={fe("title")}>
          <Input
            id="title"
            name="title"
            placeholder="SPP Oktober 2025"
            required
          />
        </Field>
        <Field label="Jatuh tempo" htmlFor="dueDate" error={fe("dueDate")}>
          <Input id="dueDate" name="dueDate" type="date" required />
        </Field>
      </div>

      <div className="rounded-lg border border-chalk bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title">Rincian biaya</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRows((p) => [...p, newRow(feeTypes[0], p.length)])}
          >
            Tambah baris
          </Button>
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="grid gap-2 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <Select
                  value={r.feeTypeId}
                  onChange={(e) => onPickFee(r.key, e.target.value)}
                  aria-label="Jenis biaya"
                >
                  <option value="">— bebas —</option>
                  {feeTypes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-4">
                <Input
                  value={r.description}
                  onChange={(e) => updateRow(r.key, { description: e.target.value })}
                  placeholder="Keterangan"
                  aria-label="Keterangan"
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  type="number"
                  min={1}
                  value={r.amount}
                  onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                  placeholder="Nominal"
                  className="tabular-nums"
                  aria-label="Nominal"
                />
              </div>
              <div className="sm:col-span-1">
                <Input
                  type="number"
                  min={1}
                  value={r.quantity}
                  onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                  className="tabular-nums"
                  aria-label="Jumlah"
                />
              </div>
              <div className="flex items-center justify-end sm:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}
                  disabled={rows.length === 1}
                  aria-label="Hapus baris"
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-chalk pt-3">
          <span className="text-sm text-slate">Total tagihan</span>
          <span className="tabular-display text-2xl text-ink">
            {formatRupiah(total)}
          </span>
        </div>
      </div>

      <Field label="Catatan (opsional)" htmlFor="note" error={fe("note")}>
        <Input id="note" name="note" placeholder="Mis. sudah termasuk seragam" />
      </Field>

      <Button type="submit" disabled={pending || total <= 0}>
        {pending ? "Menyimpan…" : "Buat tagihan"}
      </Button>
    </form>
  );
}

/** Form tagihan massal untuk seluruh siswa satu kelas. */
export function BulkInvoiceForm({
  classes,
  students,
  feeTypes,
  action,
}: {
  classes: { id: string; name: string }[];
  students: Student[];
  feeTypes: FeeType[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [feeTypeId, setFeeTypeId] = useState(feeTypes[0]?.id ?? "");
  const [amount, setAmount] = useState(feeTypes[0] ? String(feeTypes[0].amount) : "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === classId),
    [students, classId],
  );

  // Saat kelas berganti, pilih semua siswa di kelas itu.
  function onClassChange(id: string) {
    setClassId(id);
    setSelected(new Set(students.filter((s) => s.classId === id).map((s) => s.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const total = (Number(amount) || 0) * selected.size;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const fd = new FormData(e.currentTarget);
    fd.delete("studentIds");
    for (const id of selected) fd.append("studentIds", id);
    fd.set("classId", classId);

    const res = await action(fd);
    if (res.ok) {
      setSuccess(res.message ?? "Tagihan dibuat.");
      router.push("/dashboard/finance/invoices");
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="grid gap-4 rounded-lg border border-chalk bg-white p-5 sm:grid-cols-2">
        <Field label="Kelas" htmlFor="classId">
          <Select
            id="classId"
            value={classId}
            onChange={(e) => onClassChange(e.target.value)}
            required
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Judul tagihan" htmlFor="title">
          <Input id="title" name="title" placeholder="SPP Oktober 2025" required />
        </Field>
        <Field label="Jatuh tempo" htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" required />
        </Field>
        <Field label="Jenis biaya" htmlFor="feeTypeId">
          <Select
            id="feeTypeId"
            name="feeTypeId"
            value={feeTypeId}
            onChange={(e) => {
              setFeeTypeId(e.target.value);
              const f = feeTypes.find((x) => x.id === e.target.value);
              if (f) setAmount(String(f.amount));
            }}
          >
            <option value="">— bebas —</option>
            {feeTypes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nominal per siswa" htmlFor="amount">
          <Input
            id="amount"
            name="amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="tabular-nums"
          />
        </Field>
        <Field label="Catatan (opsional)" htmlFor="note">
          <Input id="note" name="note" />
        </Field>
      </div>

      <div className="rounded-lg border border-chalk bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="card-title">
            Siswa ({selected.size} dari {classStudents.length} dipilih)
          </h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelected(new Set(classStudents.map((s) => s.id)))}
            >
              Pilih semua
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSelected(new Set())}>
              Kosongkan
            </Button>
          </div>
        </div>

        {classStudents.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate">
            Kelas ini belum punya siswa aktif.
          </p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {classStudents.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-paper"
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 accent-[#1f4e46]"
                />
                <span className="text-sm text-ink">{s.fullName}</span>
                {s.nis ? (
                  <span className="font-mono text-xs text-slate">{s.nis}</span>
                ) : null}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-chalk bg-paper/40 px-5 py-4">
        <div>
          <p className="text-xs text-slate">Total nilai tagihan yang akan dibuat</p>
          <p className="tabular-display text-2xl text-ink">{formatRupiah(total)}</p>
        </div>
        <Button type="submit" disabled={pending || selected.size === 0}>
          {pending
            ? "Membuat…"
            : `Buat ${selected.size} tagihan`}
        </Button>
      </div>
    </form>
  );
}
