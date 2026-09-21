"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { MajorForm } from "./major-client";
import type { ActionResult } from "@/lib/action-result";
import type { MajorTerminology } from "@/lib/major-labels";

/**
 * Baris jurusan dengan mode tampil / ubah.
 *
 * Jumlah kelas & siswa ditampilkan sebagai angka tabular: itu angka yang
 * dicari operator saat memutuskan apakah sebuah jurusan masih dipakai.
 */
export function MajorRow({
  major,
  teachers,
  terminology,
  updateAction,
  deleteAction,
}: {
  major: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isActive: boolean;
    headTeacherId: string | null;
    headTeacherName: string | null;
    classCount: number;
    studentCount: number;
    subjectCount: number;
  };
  teachers: Array<{ id: string; fullName: string }>;
  terminology: MajorTerminology;
  updateAction: (formData: FormData) => Promise<ActionResult>;
  deleteAction: (id: string) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <tr>
        <td colSpan={7} className="bg-paper/60">
          <MajorForm
            mode="edit"
            initial={{
              id: major.id,
              code: major.code,
              name: major.name,
              description: major.description ?? "",
              headTeacherId: major.headTeacherId ?? undefined,
              isActive: major.isActive,
            }}
            teachers={teachers}
            terminology={terminology}
            action={updateAction}
            onDone={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  function doDelete() {
    setError(null);
    void deleteAction(major.id).then((res) => {
      if (!res.ok) {
        setError(res.error);
        setDeleting(false);
      }
    });
  }

  return (
    <tr>
      <td className="font-mono text-xs uppercase text-slate">{major.code}</td>
      <td>
        <span className="font-medium text-ink">{major.name}</span>
        {major.description ? (
          <span className="mt-0.5 block text-xs text-slate">{major.description}</span>
        ) : null}
      </td>
      <td className="text-slate">{major.headTeacherName ?? "—"}</td>
      <td className="tabular-nums text-slate">{major.classCount}</td>
      <td className="tabular-nums text-slate">{major.studentCount}</td>
      <td>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate">
          <span
            aria-hidden
            className={`inline-block h-2 w-2 rounded-full ${
              major.isActive ? "bg-board" : "bg-chalk"
            }`}
          />
          {major.isActive ? "Aktif" : "Nonaktif"}
        </span>
      </td>
      <td>
        <div className="flex justify-end gap-2">
          {error ? <span className="text-xs text-marker">{error}</span> : null}
          {deleting ? (
            <>
              <span className="self-center text-xs text-slate">Arsipkan?</span>
              <Button variant="danger" onClick={doDelete}>
                Ya
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                Batal
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Ubah
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(true)}>
                Arsipkan
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
