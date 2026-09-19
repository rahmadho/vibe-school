"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { TimeSlotForm } from "./time-slot-client";
import type { ActionResult } from "@/lib/action-result";

/** Baris jam pelajaran dengan mode tampil / ubah / hapus. */
export function TimeSlotRow({
  slot,
  updateAction,
  deleteAction,
}: {
  slot: {
    id: string;
    slotNumber: number;
    startTime: string;
    endTime: string;
    label: string | null;
    usedBy: number;
  };
  updateAction: (formData: FormData) => Promise<ActionResult>;
  deleteAction: (id: string) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={5} className="bg-paper/60">
          <TimeSlotForm
            mode="edit"
            initial={{
              id: slot.id,
              slotNumber: slot.slotNumber,
              startTime: slot.startTime,
              endTime: slot.endTime,
              label: slot.label ?? "",
            }}
            action={updateAction}
            onDone={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  function doDelete() {
    setPending(true);
    setError(null);
    void deleteAction(slot.id).then((res) => {
      if (!res.ok) {
        setError(res.error);
        setDeleting(false);
      }
      setPending(false);
    });
  }

  const isBreak = Boolean(slot.label);

  return (
    <tr>
      <td className="tabular-display text-lg text-ink">{slot.slotNumber}</td>
      <td className="font-mono text-sm tabular-nums text-ink">
        {slot.startTime}–{slot.endTime}
      </td>
      <td className="text-slate">
        {slot.label ?? <span className="text-slate-light">—</span>}
      </td>
      <td className="tabular-nums text-slate">{slot.usedBy}</td>
      <td>
        <div className="flex justify-end gap-2">
          {error ? <span className="self-center text-xs text-marker">{error}</span> : null}
          {deleting ? (
            <>
              <span className="self-center text-xs text-slate">Hapus?</span>
              <Button variant="danger" onClick={doDelete} disabled={pending}>
                Ya
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(false)} disabled={pending}>
                Batal
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Ubah
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDeleting(true)}
                title={isBreak ? "Jam istirahat" : undefined}
              >
                Hapus
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
