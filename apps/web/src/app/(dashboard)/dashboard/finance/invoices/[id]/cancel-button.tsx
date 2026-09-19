"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { FormError } from "@/components/form-fields";
import { cancelInvoice } from "../../actions";

/** Tombol batalkan tagihan dengan konfirmasi dua langkah. */
export function CancelInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function run() {
    setPending(true);
    setError(null);
    void cancelInvoice(invoiceId).then((res) => {
      if (res.ok) {
        router.refresh();
        setConfirming(false);
      } else {
        setError(res.error);
      }
      setPending(false);
    });
  }

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Batalkan tagihan
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <FormError message={error} />
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate">
          Yakin membatalkan tagihan ini? Tindakan ini tercatat di log.
        </span>
        <Button variant="danger" onClick={run} disabled={pending}>
          {pending ? "Membatalkan…" : "Ya, batalkan"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Tidak
        </Button>
      </div>
    </div>
  );
}
