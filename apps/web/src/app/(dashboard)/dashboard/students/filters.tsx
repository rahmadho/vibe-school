"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { Select } from "@/components/form-fields";
import {
  STUDENT_STATUSES,
  STUDENT_STATUS_LABEL,
} from "@/lib/validations/student";

/**
 * Filter daftar siswa. Submit lewat URL query agar bisa di-bookmark &
 * di-render ulang oleh server component.
 */
export function StudentFilters({
  classes,
  current,
}: {
  classes: Array<{ id: string; name: string }>;
  current: { q: string; classId: string; status: string };
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(current.q);
  const [classId, setClassId] = useState(current.classId);
  const [status, setStatus] = useState(current.status);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (classId) sp.set("classId", classId);
    if (status) sp.set("status", status);
    sp.set("page", "1");
    router.push(`/dashboard/students?${sp.toString()}`);
  }

  function reset() {
    setQ("");
    setClassId("");
    setStatus("");
    router.push("/dashboard/students");
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
    >
      <div className="min-w-[200px] flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate">
          Cari
        </label>
        <Input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nama, NIS, atau NISN"
        />
      </div>

      <div className="w-40">
        <label
          htmlFor="classId"
          className="mb-1 block text-xs font-medium text-slate"
        >
          Kelas
        </label>
        <Select
          id="classId"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">Semua kelas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-40">
        <label
          htmlFor="status"
          className="mb-1 block text-xs font-medium text-slate"
        >
          Status
        </label>
        <Select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Semua status</option>
          {STUDENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STUDENT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2">
        <Button type="submit">Terapkan</Button>
        {(current.q || current.classId || current.status) && (
          <Button type="button" variant="ghost" onClick={reset}>
            Reset
          </Button>
        )}
      </div>
    </form>
  );
}
