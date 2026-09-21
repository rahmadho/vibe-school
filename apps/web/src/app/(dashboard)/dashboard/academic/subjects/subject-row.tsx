"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { SubjectForm } from "./subject-client";
import { SUBJECT_GROUP_LABEL } from "@/lib/validations/academic";
import type { ActionResult } from "@/lib/action-result";

/**
 * Baris mapel dengan mode tampil / ubah.
 * Dipakai di halaman daftar mapel.
 */
export function SubjectRow({
  subject,
  majors,
  terminology,
  updateAction,
  deleteAction,
}: {
  subject: {
    id: string;
    code: string;
    name: string;
    kkm: number;
    teacherCount: number;
    group: string;
    majorId: string | null;
    majorLabel: string | null;
  };
  majors: Array<{ id: string; code: string; name: string }>;
  terminology: string;
  updateAction: (formData: FormData) => Promise<ActionResult>;
  deleteAction: (id: string) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <tr>
        <td colSpan={6} className="bg-paper/60">
          <SubjectForm
            mode="edit"
            initial={{
              id: subject.id,
              code: subject.code,
              name: subject.name,
              kkm: subject.kkm,
              group: subject.group,
              majorId: subject.majorId ?? "",
            }}
            majors={majors}
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
    void deleteAction(subject.id).then((res) => {
      if (!res.ok) {
        setError(res.error);
        setDeleting(false);
      }
    });
  }

  return (
    <tr>
      <td className="font-mono text-xs uppercase text-slate">{subject.code}</td>
      <td className="font-medium text-ink">{subject.name}</td>
      <td className="text-xs text-slate">
        {SUBJECT_GROUP_LABEL[subject.group as keyof typeof SUBJECT_GROUP_LABEL] ?? subject.group}
        {subject.majorLabel ? (
          <span className="ml-1 text-slate-light">· {subject.majorLabel}</span>
        ) : null}
      </td>
      <td className="tabular-nums text-slate">{subject.kkm}</td>
      <td className="tabular-nums text-slate">{subject.teacherCount}</td>
      <td>
        <div className="flex justify-end gap-2">
          {error ? <span className="text-xs text-marker">{error}</span> : null}
          {deleting ? (
            <>
              <span className="self-center text-xs text-slate">Hapus?</span>
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
                Hapus
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
