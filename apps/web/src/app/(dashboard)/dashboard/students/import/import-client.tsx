"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { FormError, FormSuccess } from "@/components/form-fields";
import type { ParseResult } from "@/lib/import/students";
import { previewImport, commitImport } from "./actions";

/**
 * Alur import dua langkah:
 *  1. Pilih file → PREVIEW (baris valid/gagal ditampilkan).
 *  2. Tekan "Import" → baris valid disimpan.
 */
export function ImportClient() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSuccess(null);
    setPreview(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    setBuffer(buf);

    startTransition(async () => {
      try {
        const res = await previewImport(buf);
        if (res.headerErrors.length) {
          setError(res.headerErrors.join(" "));
          setPreview(null);
          return;
        }
        setPreview(res);
      } catch {
        setError("Gagal membaca file. Pastikan format .xlsx benar.");
      }
    });
  }

  function doImport() {
    if (!buffer) return;
    setError(null);
    startTransition(async () => {
      const res = await commitImport(buffer);
      if (!res.ok) {
        setError(res.message ?? "Import gagal.");
        return;
      }
      setSuccess(res.message ?? "Selesai.");
      if (res.errors.length) {
        setError(`${res.errors.length} baris dilewati. Lihat daftar di bawah.`);
      }
      setPreview(null);
    });
  }

  return (
    <section className="card space-y-4">
      <h2 className="card-title">Unggah file</h2>

      <FormError message={error} />
      <FormSuccess message={success} />

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={onFile}
        disabled={pending}
        className="block w-full cursor-pointer rounded border border-chalk bg-white text-sm file:mr-3 file:border-0 file:bg-chalk/50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-ink hover:file:bg-chalk"
      />
      {fileName ? (
        <p className="text-xs text-slate">File: {fileName}</p>
      ) : null}

      {preview ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6 rounded border border-chalk bg-paper px-4 py-3 text-sm">
            <span className="tabular-display text-xl text-board">
              {preview.validCount}
            </span>
            <span className="self-center text-slate">baris valid</span>
            <span className="tabular-display text-xl text-marker">
              {preview.invalidCount}
            </span>
            <span className="self-center text-slate">baris bermasalah</span>
          </div>

          <div className="max-h-80 overflow-auto rounded border border-chalk">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-16">Baris</th>
                  <th className="w-24">Status</th>
                  <th>NIS / nama</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="tabular-nums text-slate">{r.rowNumber}</td>
                    <td>
                      <span
                        className={
                          r.ok ? "text-board" : "text-marker"
                        }
                      >
                        {r.ok ? "Siap" : "Lewat"}
                      </span>
                    </td>
                    <td className="text-ink">
                      {r.ok
                        ? `${r.data?.nis} · ${r.data?.fullName}`
                        : "—"}
                    </td>
                    <td className="text-xs text-slate">
                      {r.ok ? "" : (r.errors ?? []).join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button onClick={doImport} disabled={pending || preview.validCount === 0}>
              {pending ? "Mengimpor…" : `Import ${preview.validCount} siswa`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setBuffer(null);
                setFileName(null);
              }}
              disabled={pending}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
