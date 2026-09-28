"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { terbitkanKwitansiAksi } from "./kwitansi-actions";

/**
 * Tombol cetak kwitansi.
 *
 * Nomor kwitansi diterbitkan di server SAAT PERTAMA dicetak, lalu dibuka di
 * tab baru. Tombol ini tidak menghitung nomor sendiri — kalau menghitung di
 * peramban, dua orang yang menekan bersamaan bisa mendapat nomor sama.
 */
export function CetakKwitansiButton({
  paymentId,
  sudahAda,
}: {
  paymentId: string;
  sudahAda: boolean;
}) {
  const [pesan, setPesan] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setPesan(null);
    startTransition(async () => {
      const hasil = await terbitkanKwitansiAksi(paymentId);
      if (!hasil.ok) {
        setPesan(hasil.error);
        return;
      }
      setPesan(
        hasil.sudahAda
          ? `Kwitansi ${hasil.receiptNo} sudah pernah diterbitkan — membuka yang lama.`
          : `Kwitansi ${hasil.receiptNo} diterbitkan.`,
      );
      // Buka PDF di tab baru supaya halaman tidak hilang.
      window.open(`/api/kwitansi/${paymentId}`, "_blank", "noopener");
    });
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <Button type="button" variant="secondary" onClick={onClick} disabled={pending}>
        {pending ? "Menyiapkan…" : sudahAda ? "Cetak kwitansi" : "Terbitkan kwitansi"}
      </Button>
      {pesan && <span className="text-xs text-slate">{pesan}</span>}
    </div>
  );
}
