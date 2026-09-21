"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { cx } from "@/components/ui";

/**
 * Pemilih gambar dari pustaka media.
 *
 * ============================================================
 * KENAPA ADA PEMILIH, BUKAN HANYA KOLOM ALAMAT
 * ============================================================
 * Sebelum ini operator harus menempel alamat gambar sendiri ke kolom teks.
 * Akibatnya gambar yang sudah diunggah lewat menu Media tidak pernah dipakai
 * lagi (alamatnya tidak dihafal), dan gambar dari internet dipakai tanpa
 * diketahui siapa pemiliknya. Pemilih membuat berkas yang sudah ada bisa
 * dipakai ulang dengan satu klik.
 *
 * Kolom alamat tetap disediakan sebagai jalan kedua: kadang operator memang
 * hanya punya tautan, dan memaksa mengunggah lebih dulu akan menghalangi.
 *
 * ============================================================
 * KENAPA TIDAK MODAL
 * ============================================================
 * Modal menutup konteks tulisan yang sedang disunting. Panel ini tumbuh di
 * tempat, dan isi berita tetap terlihat.
 */

export type PickerMedia = {
  id: string;
  name: string;
  url: string;
  width: number | null;
  height: number | null;
};

export function MediaPicker({
  value,
  onChange,
  media,
  label = "Gambar sampul (opsional)",
  id = "coverUrl",
}: {
  value: string;
  onChange: (url: string) => void;
  media: PickerMedia[];
  label?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>

      {value ? (
        <div className="flex flex-wrap items-start gap-3 border border-chalk bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Pratinjau gambar"
            className="h-24 w-32 shrink-0 border border-chalk object-cover"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="break-all font-mono text-xs text-slate">{value}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen((o) => !o)}>
                {open ? "Tutup pustaka" : "Ganti dari pustaka"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => onChange("")}>
                Lepas gambar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen((o) => !o)}>
              {open ? "Tutup pustaka" : "Pilih dari pustaka"}
            </Button>
          </div>
          <input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/uploads/… atau https://…"
            className="w-full rounded border border-chalk bg-white px-3 py-2 font-mono text-sm"
          />
        </div>
      )}

      {open ? (
        <div className="mt-2 border-2 border-[var(--ink)] bg-white p-3">
          {media.length === 0 ? (
            <p className="text-sm text-slate">
              Pustaka media masih kosong. Buka menu{" "}
              <strong className="text-ink">Web Sekolah → Media</strong> untuk
              menambahkan gambar.
            </p>
          ) : (
            <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
              {media.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(m.url);
                      setOpen(false);
                    }}
                    title={m.name}
                    className={cx(
                      "block w-full border-2 p-0.5",
                      value === m.url ? "border-[var(--board)]" : "border-chalk hover:border-ink",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt={m.name}
                      loading="lazy"
                      className="h-16 w-full object-cover"
                    />
                    <span className="mt-0.5 block truncate text-[10px] text-slate">
                      {m.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
