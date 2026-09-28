"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { batalkanKwitansiAksi } from "./batal-kwitansi-actions";

/**
 * Tombol + formulir pembatalan kwitansi.
 *
 * Ditampilkan hanya kepada pengguna dengan izin `finance: manage`. Alasan
 * pembatalan wajib diisi — pembatalan dokumen resmi tanpa alasan membuat
 * jejak audit tidak berguna saat pemeriksaan.
 */
export function BatalKwitansiButton({ receiptId }: { receiptId: string }) {
  const [terbuka, setTerbuka] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("receiptId", receiptId);
    fd.set("alasan", alasan);

    startTransition(async () => {
      const hasil = await batalkanKwitansiAksi(fd);
      if (!hasil.ok) {
        setError(hasil.error);
        return;
      }
      setTerbuka(false);
      setAlasan("");
    });
  }

  if (!terbuka) {
    return (
      <Button type="button" variant="ghost" onClick={() => setTerbuka(true)}>
        Batalkan
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 text-left">
      <Field label="Alasan pembatalan" htmlFor={`alasan-${receiptId}`} error={error ?? undefined}>
        <Input
          id={`alasan-${receiptId}`}
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          placeholder="mis. salah input nominal"
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Membatalkan…" : "Batalkan kwitansi"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setTerbuka(false);
            setError(null);
          }}
        >
          Tidak jadi
        </Button>
      </div>
    </form>
  );
}
