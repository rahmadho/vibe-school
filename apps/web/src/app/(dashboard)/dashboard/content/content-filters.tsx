"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { Select } from "@/components/form-fields";
import { POST_TYPES, POST_TYPE_LABEL } from "@/lib/validations/site";

/**
 * Filter daftar konten. Submit lewat URL query agar bisa di-bookmark &
 * di-render ulang oleh server component.
 */
export function ContentFilters({
  current,
}: {
  current: { q: string; type: string; status: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState(current.q);
  const [type, setType] = useState(current.type);
  const [status, setStatus] = useState(current.status);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (type) sp.set("type", type);
    if (status) sp.set("status", status);
    router.push(`/dashboard/content?${sp.toString()}`);
  }

  function reset() {
    setQ("");
    setType("");
    setStatus("");
    router.push("/dashboard/content");
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-3 border-2 border-[var(--chalk)] bg-white p-4"
    >
      <div className="min-w-[200px] flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate">
          Cari judul
        </label>
        <Input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Judul tulisan"
        />
      </div>

      <div className="w-40">
        <label htmlFor="type" className="mb-1 block text-xs font-medium text-slate">
          Jenis
        </label>
        <Select id="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Semua jenis</option>
          {POST_TYPES.map((t) => (
            <option key={t} value={t}>
              {POST_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-40">
        <label htmlFor="status" className="mb-1 block text-xs font-medium text-slate">
          Status
        </label>
        <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          <option value="draft">Draf</option>
          <option value="published">Terbit</option>
          <option value="scheduled">Terjadwal</option>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button type="submit">Terapkan</Button>
        {(current.q || current.type || current.status) && (
          <Button type="button" variant="ghost" onClick={reset}>
            Reset
          </Button>
        )}
      </div>
    </form>
  );
}
