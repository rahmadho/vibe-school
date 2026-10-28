"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Select, FormError, FormSuccess } from "@/components/form-fields";
import { publishGrades, unpublishGrades } from "./actions";

/** Tombol publikasi + batal, satu form per baris tabel. */
export function PublishForm({
  classes,
  semesters,
}: {
  classes: { id: string; name: string; level: number }[];
  semesters: { id: string; label: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await publishGrades(fd);
      if (res.ok) {
        setSuccess(res.message ?? "Dipublikasikan.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <Select name="classId" required defaultValue="" className="w-40">
        <option value="">— Kelas —</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select name="semesterId" required defaultValue="" className="w-56">
        <option value="">— Semester —</option>
        {semesters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? "Memproses…" : "Publikasikan nilai"}
      </Button>
      <div className="w-full">
        <FormError message={error} />
        <FormSuccess message={success} />
      </div>
    </form>
  );
}

export function UnpublishButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="rounded-lg border border-chalk px-3 py-1.5 text-xs font-medium text-board disabled:opacity-50"
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("id", id);
            const res = await unpublishGrades(fd);
            setError(res.ok ? null : res.error);
            router.refresh();
          })
        }
      >
        {pending ? "Membatalkan…" : "Batalkan publikasi"}
      </button>
      <FormError message={error} />
    </div>
  );
}
