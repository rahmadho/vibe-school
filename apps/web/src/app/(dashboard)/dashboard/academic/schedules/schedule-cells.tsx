"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field } from "@/components/ui";
import { Select, FormError } from "@/components/form-fields";
import { DAYS, DAY_LABEL } from "@/lib/validations/schedule";
import type { ActionResult } from "@/lib/action-result";

type Option = { id: string; name: string };
type SlotOption = { id: string; label: string };

/**
 * Dialog tambah jadwal. Muncul dari sel grid yang kosong.
 *
 * Karena bentrok dicek di server, error bentrok ditampilkan jelas di sini —
 * guru/kelas mana yang bertabrakan.
 */
export function ScheduleDialog({
  classId,
  dayOfWeek,
  timeSlotId,
  subjects,
  teachers,
  open,
  onClose,
  action,
}: {
  classId: string;
  dayOfWeek: number;
  timeSlotId: string;
  subjects: Option[];
  teachers: Option[];
  open: boolean;
  onClose: () => void;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await action(new FormData(e.currentTarget));
    if (res.ok) {
      router.refresh();
      onClose();
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-chalk bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="card-title">
          Tambah jadwal — {DAY_LABEL[dayOfWeek as 1]}
        </h2>
        <p className="mt-1 text-xs text-slate">
          Bentrok jadwal guru & kelas diperiksa otomatis.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
          <FormError message={error} />
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
          <input type="hidden" name="timeSlotId" value={timeSlotId} />

          <Field label="Mata pelajaran" htmlFor="subjectId">
            <Select id="subjectId" name="subjectId" required defaultValue="">
              <option value="">Pilih mapel…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Guru pengampu" htmlFor="teacherId">
            <Select id="teacherId" name="teacherId" required defaultValue="">
              <option value="">Pilih guru…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Ruang (opsional)" htmlFor="room">
            <input
              id="room"
              name="room"
              placeholder="Lab IPA"
              className="h-10 w-full rounded border border-chalk px-3 text-sm focus:border-board focus:outline-none"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan jadwal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Sel jadwal yang sudah terisi — klik untuk opsi ubah/hapus. */
export function FilledCell({
  entry,
  onEdit,
  onDelete,
}: {
  entry: {
    id: string;
    subjectName: string;
    teacherName: string;
    room: string | null;
  };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="group relative h-full rounded border border-chalk bg-white p-2 text-left">
      <p className="text-xs font-medium leading-snug text-ink">{entry.subjectName}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-slate">{entry.teacherName}</p>
      {entry.room ? (
        <p className="text-[11px] text-slate-light">{entry.room}</p>
      ) : null}

      <div className="absolute inset-0 hidden items-center justify-center gap-1 rounded bg-paper/95 group-hover:flex">
        {confirming ? (
          <>
            <span className="text-xs text-slate">Hapus?</span>
            <Button variant="danger" onClick={onDelete}>
              Ya
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Batal
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onEdit}>
              Ubah
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Hapus
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
