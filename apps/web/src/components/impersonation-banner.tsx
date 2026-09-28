"use client";

import { useTransition } from "react";
import { stopImpersonation } from "@/app/(dashboard)/dashboard/schools/[id]/impersonate-actions";

/**
 * Spanduk peringatan saat sesi ini adalah hasil "Masuk sebagai".
 *
 * SELALU terlihat di bagian atas setiap halaman dasbor. Ini bukan hiasan:
 * tanpa penanda yang mencolok, Super Admin mudah lupa bahwa ia sedang
 * memerankan orang lain — lalu mengubah data atas nama pengguna tersebut
 * tanpa sadar. Spanduk ini yang menjaga batas antara "menguji" dan
 * "menggunakan" tetap kasat mata.
 */
export function ImpersonationBanner({ actorName }: { actorName: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p>
          Anda masuk <strong>sebagai pengguna ini</strong> atas nama{" "}
          <strong>{actorName}</strong>. Semua tindakan tercatat.
        </p>
        <button
          type="button"
          onClick={() => startTransition(() => void stopImpersonation())}
          disabled={pending}
          className="shrink-0 rounded border border-amber-400 bg-white px-3 py-1 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {pending ? "Kembali…" : "Kembali ke akun saya"}
        </button>
      </div>
    </div>
  );
}
