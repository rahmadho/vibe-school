"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { FormError } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

/**
 * Tombol nonaktifkan generik (konfirmasi dua-langkah).
 * Dipakai guru, staf, kelas, mapel.
 */
export function DeleteButton({
  id,
  name,
  entityLabel,
  redirectTo,
  action,
  description,
}: {
  id: string;
  name: string;
  entityLabel: string;
  redirectTo: string;
  action: (id: string) => Promise<ActionResult>;
  description?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await action(id);
      if (res.ok) {
        router.push(redirectTo);
        router.refresh();
      } else {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Nonaktifkan {entityLabel}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <FormError message={error} />
      <p className="text-sm text-ink">
        {description ?? `Nonaktifkan ${entityLabel}`} <strong>{name}</strong>?
        Tindakan ini tercatat di log.
      </p>
      <div className="flex gap-2">
        <Button variant="danger" onClick={run} disabled={pending}>
          {pending ? "Memproses…" : "Ya, lanjutkan"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Batal
        </Button>
      </div>
    </div>
  );
}
