"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  QUEUE_STATUS_LABEL,
  QUEUE_STATUS_DOT,
  REF_TYPE_LABEL,
  type QueueStatusValue,
} from "@/lib/notification-labels";
import { retryMessage, cancelMessage } from "./actions";

export type QueueRowData = {
  id: string;
  to: string;
  recipientName: string | null;
  body: string;
  status: string;
  attempts: number;
  lastError: string | null;
  refType: string | null;
  createdAt: Date;
  sentAt: Date | null;
  nextAttemptAt: Date | null;
};

/** Samarkan nomor: tampilkan sebagian saja. */
function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  return `${phone.slice(0, 4)}•••${phone.slice(-3)}`;
}

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function QueueRow({
  row,
  canManage,
}: {
  row: QueueRowData;
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const status = (row.status as QueueStatusValue) ?? "QUEUED";

  function run(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn(row.id);
      if (!res.ok) setError(res.error ?? "Gagal.");
      else router.refresh();
    });
  }

  const canRetry = status === "FAILED" || status === "CANCELLED";
  const canCancel = status === "QUEUED";

  return (
    <tr className="border-t border-chalk align-top even:bg-board/30">
      <td className="px-4 py-3">
        <div className="font-mono text-xs tabular-nums text-ink">
          {maskPhone(row.to)}
        </div>
        {row.recipientName && (
          <div className="mt-0.5 text-xs text-slate">{row.recipientName}</div>
        )}
        {row.refType && (
          <span className="mt-1 inline-block rounded bg-board px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate">
            {REF_TYPE_LABEL[row.refType] ?? row.refType}
          </span>
        )}
      </td>

      <td className="max-w-md px-4 py-3">
        <p className="line-clamp-2 text-xs text-slate" title={row.body}>
          {row.body}
        </p>
        {row.lastError && (
          <p className="mt-1 text-[11px] text-marker" title={row.lastError}>
            {row.lastError.slice(0, 120)}
          </p>
        )}
      </td>

      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${QUEUE_STATUS_DOT[status]}`} />
          <span className="text-ink">{QUEUE_STATUS_LABEL[status]}</span>
        </span>
        <div className="mt-1 text-[11px] text-slate">
          {row.sentAt ? fmt(row.sentAt) : fmt(row.createdAt)}
        </div>
        {status === "QUEUED" && row.nextAttemptAt && (
          <div className="text-[11px] text-amber-700">
            coba lagi {fmt(row.nextAttemptAt)}
          </div>
        )}
      </td>

      <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate">
        {row.attempts}/4
      </td>

      {canManage && (
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {canRetry && (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run(retryMessage)}
              >
                Kirim ulang
              </Button>
            )}
            {canCancel && (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run(cancelMessage)}
              >
                Batalkan
              </Button>
            )}
            {!canRetry && !canCancel && (
              <span className="text-xs text-slate">—</span>
            )}
          </div>
          {error && <p className="mt-1 text-[11px] text-marker">{error}</p>}
        </td>
      )}
    </tr>
  );
}
