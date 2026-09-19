"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError, FormSuccess } from "@/components/form-fields";
import { formatRupiah } from "@/lib/finance-calc";
import type { ActionResult } from "@/lib/action-result";

/**
 * Catat pembayaran manual (tunai / transfer bank).
 * Ini jalur yang dipakai bendahara sehari-hari.
 */
export function ManualPaymentForm({
  invoiceId,
  remaining,
  methods,
  action,
}: {
  invoiceId: string;
  remaining: number;
  methods: { id: string; name: string }[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const fe = (n: string) => fieldErrors[n]?.[0];

  // Tanggal hari ini untuk nilai awal.
  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    const form = e.currentTarget;

    const fd = new FormData(form);
    fd.set("invoiceId", invoiceId);

    const res = await action(fd);
    if (res.ok) {
      setSuccess(res.message ?? "Pembayaran dicatat.");
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
      <FormSuccess message={success} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nominal dibayar" htmlFor="amount" error={fe("amount")}>
          <Input
            id="amount"
            name="amount"
            type="number"
            min={1}
            max={remaining}
            defaultValue={remaining}
            required
            className="tabular-nums"
          />
        </Field>
        <Field label="Metode" htmlFor="methodId" error={fe("methodId")}>
          <Select id="methodId" name="methodId" defaultValue={methods[0]?.id ?? ""}>
            <option value="">— tidak disebutkan —</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tanggal bayar" htmlFor="paidAt" error={fe("paidAt")}>
          <Input id="paidAt" name="paidAt" type="date" defaultValue={today} />
        </Field>
        <Field label="No. referensi" htmlFor="reference" error={fe("reference")}>
          <Input
            id="reference"
            name="reference"
            placeholder="Nomor transfer / kuitansi"
          />
        </Field>
      </div>

      <Field label="Catatan" htmlFor="note" error={fe("note")}>
        <Input id="note" name="note" placeholder="Mis. dibayar tunai oleh ayah" />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || remaining <= 0}>
          {pending ? "Menyimpan…" : `Catat pembayaran ${formatRupiah(remaining)}`}
        </Button>
        <p className="text-xs text-slate">
          Sisa tagihan saat ini {formatRupiah(remaining)}.
        </p>
      </div>
    </form>
  );
}

/** Tombol buat tautan pembayaran online (Midtrans/Xendit). */
export function PaymentLinkButton({
  invoiceId,
  gatewayName,
  action,
}: {
  invoiceId: string;
  gatewayName: string | null;
  action: (invoiceId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!gatewayName) {
    return (
      <p className="rounded border border-chalk bg-paper/40 px-3 py-3 text-sm text-slate">
        Payment gateway belum aktif. Aktifkan Midtrans/Xendit di{" "}
        <a href="/dashboard/finance/gateway" className="text-board underline">
          Pengaturan gateway
        </a>{" "}
        untuk menerima pembayaran online. Pembayaran manual tetap bisa dicatat di
        samping.
      </p>
    );
  }

  function run() {
    setPending(true);
    setError(null);
    void action(invoiceId).then((res) => {
      if (!res.ok) {
        setError(res.error);
      } else {
        // Pesan berisi tautan — ambil URL-nya untuk ditampilkan sebagai tombol.
        const m = res.message?.match(/https?:\/\/\S+/);
        setLink(m ? m[0] : null);
        if (!m) setError(null);
        router.refresh();
      }
      setPending(false);
    });
  }

  return (
    <div className="space-y-2">
      <FormError message={error} />
      {link ? (
        <div className="rounded border border-board/30 bg-board/5 p-3">
          <p className="text-sm text-ink">Tautan pembayaran siap dibagikan:</p>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all font-mono text-xs text-board underline"
          >
            {link}
          </a>
        </div>
      ) : null}
      <Button onClick={run} disabled={pending} variant="secondary">
        {pending ? "Membuat…" : `Buat tautan ${gatewayName}`}
      </Button>
    </div>
  );
}
