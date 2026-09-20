"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { FormError, FormSuccess } from "@/components/form-fields";
import { cancelAllQueued, retryAllFailed, sendTestMessage } from "./actions";

/** Form kirim pesan uji ke satu nomor. */
export function TestSendForm({ defaultBody = "" }: { defaultBody?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await sendTestMessage(fd);
      if (res.ok) {
        setSuccess(res.message ?? "Pesan masuk antrean.");
        form.reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-chalk bg-paper p-4"
    >
      <h2 className="font-medium text-ink">Kirim pesan uji</h2>
      <p className="text-xs text-slate">
        Uji coba memakai jalur antrean yang sama dengan pesan sungguhan, jadi hasilnya
        menggambarkan kondisi sebenarnya. Secara bawaan pesan langsung dikirim (tanpa
        menunggu jam kirim).
      </p>

      <Field label="Nomor WhatsApp" htmlFor="test-phone">
        <Input
          id="test-phone"
          name="phone"
          placeholder="081234567890"
          inputMode="tel"
          required
        />
      </Field>

      <Field label="Isi pesan" htmlFor="test-body">
        <textarea
          id="test-body"
          name="body"
          rows={4}
          defaultValue={defaultBody || "Pesan uji dari School App. Mohon diabaikan."}
          className="w-full rounded-md border border-chalk bg-paper px-3 py-2 text-sm text-ink"
          required
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="sendNow"
          defaultChecked
          className="h-4 w-4 accent-board"
        />
        Kirim sekarang (abaikan jam kirim 07:00–20:00)
      </label>

      <FormError message={error} />
      <FormSuccess message={success} />

      <Button type="submit" disabled={pending}>
        {pending ? "Mengantrekan…" : "Kirim pesan uji"}
      </Button>
    </form>
  );
}

/** Tombol massal untuk antrean yang bermasalah. */
export function QueueBulkActions({
  canManage,
  failedCount = 0,
  queuedCount = 0,
}: {
  canManage: boolean;
  failedCount?: number;
  queuedCount?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!canManage) return null;

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setSuccess(res.message ?? "Selesai.");
        router.refresh();
      } else {
        setError(res.error ?? "Gagal.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => run(retryAllFailed)}
        title="Coba kirim ulang semua pesan yang gagal"
      >
        Kirim ulang gagal{failedCount > 0 ? ` (${failedCount})` : ""}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => run(cancelAllQueued)}
        title="Batalkan semua pesan yang masih menunggu"
      >
        Batalkan antrean{queuedCount > 0 ? ` (${queuedCount})` : ""}
      </Button>
      {(error || success) && (
        <div className="w-full">
          <FormError message={error} />
          <FormSuccess message={success} />
        </div>
      )}
    </div>
  );
}
