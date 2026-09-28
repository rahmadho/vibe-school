"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { FormError } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

/**
 * Tombol "Masuk sebagai" — hanya ditampilkan untuk super-admin (pemanggil yang
 * memutuskan, lihat halaman detail pengguna). Server action-lah yang
 * memverifikasi ulang hak; komponen ini sekadar pemicu.
 *
 * Sengaja memakai dialog konfirmasi bawaan peramban: impersonasi adalah
 * tindakan sensitif, dan pemisahan langkah mencegah klik tak sengaja.
 */
export function ImpersonateButton({
  targetUserId,
  targetName,
  action,
  className,
}: {
  targetUserId: string;
  targetName: string;
  action: (targetUserId: string) => Promise<ActionResult>;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    const ok = window.confirm(
      `Masuk sebagai ${targetName}?\n\n` +
        "Anda akan melihat aplikasi persis seperti yang dilihat pengguna ini. " +
        "Tindakan ini tercatat di Log Aktivitas.",
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const res = await action(targetUserId);
      // Saat berhasil, signIn di server melakukan redirect — kode ini biasanya
      // tidak sampai dieksekusi. Bila sampai, tampilkan pesannya.
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <FormError message={error} />
      <Button
        variant="secondary"
        onClick={run}
        disabled={pending}
        className={className}
      >
        {pending ? "Membuka…" : "Masuk sebagai pengguna ini"}
      </Button>
    </div>
  );
}
