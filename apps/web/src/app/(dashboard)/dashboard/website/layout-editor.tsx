"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import {
  saveHomepageLayout,
  saveBlockProps,
  moveNavItem,
} from "@/app/(dashboard)/dashboard/website/actions";
import { BLOCK_DEFINITIONS, getVariant } from "@/lib/site-blocks";

/**
 * Penyusun halaman depan.
 *
 * KENAPA TOMBOL NAIK/TURUN, BUKAN GESER-LEPAS:
 * Operator sekolah sering bekerja dari ponsel, dan geser-lepas rapuh di layar
 * sentuh (sering salah jatuh, dan tidak bisa dipakai pembaca layar). Tombol
 * naik/turun bekerja di mana saja, bisa dioperasikan keyboard, dan tidak
 * memerlukan pustaka tambahan.
 *
 * Susunan dikirim SEKALIGUS saat tombol simpan ditekan — bukan per gerakan —
 * supaya jaringan yang putus di tengah tidak meninggalkan urutan separuh jadi.
 */

type BlockRow = {
  blockKey: string;
  variantKey: string;
  order: number;
  isEnabled: boolean;
  isSaved: boolean;
};

export function LayoutEditor({
  initialBlocks,
  schoolName,
}: {
  initialBlocks: BlockRow[];
  schoolName: string;
}) {
  const [blocks, setBlocks] = useState<BlockRow[]>(initialBlocks);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  /** Pindahkan satu blok naik/turun, lalu rapikan nomor urutnya 0..n-1. */
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;

    setBlocks((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((b, i) => ({ ...b, order: i }));
    });
  }

  function toggle(index: number) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, isEnabled: !b.isEnabled } : b)),
    );
  }

  function setVariant(index: number, variantKey: string) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, variantKey } : b)));
  }

  /** Tambahkan blok yang belum dipakai di halaman depan. */
  function addBlock(blockKey: string) {
    const def = BLOCK_DEFINITIONS.find((d) => d.key === blockKey);
    if (!def) return;
    if (blocks.some((b) => b.blockKey === blockKey)) return;

    setBlocks((prev) => [
      ...prev,
      {
        blockKey,
        variantKey: def.defaultVariant,
        order: prev.length,
        isEnabled: true,
        isSaved: false,
      },
    ]);
  }

  function remove(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i })));
  }

  function save() {
    const fd = new FormData();
    blocks.forEach((b, i) => {
      fd.append(`blocks[${i}][blockKey]`, b.blockKey);
      fd.append(`blocks[${i}][variantKey]`, b.variantKey);
      fd.append(`blocks[${i}][order]`, String(i));
      fd.append(`blocks[${i}][isEnabled]`, b.isEnabled ? "true" : "false");
    });

    startTransition(async () => {
      const r = await saveHomepageLayout(fd);
      setResult(r);
      if (r.ok) setBlocks((prev) => prev.map((b) => ({ ...b, isSaved: true })));
    });
  }

  const unused = BLOCK_DEFINITIONS.filter(
    (d) => !blocks.some((b) => b.blockKey === d.key),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--ink)] pb-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
            Susunan halaman depan
          </h2>
          <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
            Urutan dari atas ke bawah di {schoolName}. Matikan blok untuk menyembunyikannya
            tanpa menghapus isinya.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="border-2 border-[var(--ink)] bg-[var(--marker)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
        >
          {pending ? "Menyimpan…" : "Simpan susunan"}
        </button>
      </div>

      {result && !result.ok && (
        <p className="border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <p className="border-l-4 border-emerald-700 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Susunan tersimpan. Buka web sekolah untuk melihat hasilnya.
        </p>
      )}

      {blocks.length === 0 && (
        <div className="border-2 border-dashed border-[var(--rule)] px-4 py-8 text-center">
          <p className="font-medium text-[var(--ink)]">Halaman depan masih kosong</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Tambahkan blok dari daftar di bawah untuk mulai menyusun.
          </p>
        </div>
      )}

      <ol className="space-y-2">
        {blocks.map((b, i) => {
          const def = BLOCK_DEFINITIONS.find((d) => d.key === b.blockKey);
          if (!def) return null;
          const variantInfo = getVariant(b.variantKey);
          const isOpen = openKey === b.blockKey;

          return (
            <li
              key={b.blockKey}
              className="border-2 border-[var(--rule)] bg-white"
              style={{ opacity: b.isEnabled ? 1 : 0.55 }}
            >
              <div className="flex items-start gap-2 p-3">
                {/* Nomor urut — di sini memang urutan, jadi angka bermakna. */}
                <span className="mt-0.5 w-6 shrink-0 text-center font-mono text-sm text-[var(--ink-soft)]">
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span aria-hidden className="text-base">{def.icon}</span>
                    <span className="font-medium text-[var(--ink)]">{def.name}</span>
                    {!b.isSaved && (
                      <span className="border border-[var(--marker)] bg-[var(--marker)]/30 px-1.5 py-0.5 text-[11px] text-[var(--ink)]">
                        baru
                      </span>
                    )}
                    {!b.isEnabled && (
                      <span className="text-[11px] text-[var(--ink-soft)]">disembunyikan</span>
                    )}
                  </div>

                  <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{def.description}</p>

                  {def.variants.length > 1 && (
                    <label className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-[var(--ink-soft)]">Gaya tampilan</span>
                      <select
                        value={b.variantKey}
                        onChange={(e) => setVariant(i, e.target.value)}
                        className="border border-[var(--rule)] bg-white px-2 py-1 text-xs text-[var(--ink)]"
                      >
                        {def.variants.map((v) => (
                          <option key={v.key} value={v.key}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {variantInfo?.variant.hint && (
                    <p className="mt-1 text-[11px] italic text-[var(--ink-soft)]">
                      {variantInfo.variant.hint}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Naikkan ${def.name}`}
                    className="border border-[var(--rule)] px-2 py-0.5 text-xs disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === blocks.length - 1}
                    aria-label={`Turunkan ${def.name}`}
                    className="border border-[var(--rule)] px-2 py-0.5 text-xs disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="border border-[var(--rule)] px-2 py-0.5 text-xs"
                  >
                    {b.isEnabled ? "Sembunyikan" : "Tampilkan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenKey(isOpen ? null : b.blockKey)}
                    className="border border-[var(--rule)] px-2 py-0.5 text-xs"
                  >
                    {isOpen ? "Tutup isi" : "Isi"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-xs text-red-800 underline"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              {isOpen && <BlockPropsForm blockKey={b.blockKey} />}
            </li>
          );
        })}
      </ol>

      {unused.length > 0 && (
        <div className="border-t-2 border-[var(--rule)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--ink)]">Tambahkan blok</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {unused.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => addBlock(d.key)}
                className="border-2 border-[var(--rule)] bg-white px-3 py-1.5 text-sm text-[var(--ink)] hover:border-[var(--ink)]"
              >
                <span aria-hidden className="mr-1">{d.icon}</span>
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Formulir isi satu blok.
 *
 * Field dibuat dari `definition.fields` — bukan ditulis tangan per blok — supaya
 * menambah blok baru di katalog otomatis mendapat formulirnya.
 */
function BlockPropsForm({ blockKey }: { blockKey: string }) {
  const def = BLOCK_DEFINITIONS.find((d) => d.key === blockKey);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  if (!def) return null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("blockKey", blockKey);
    startTransition(async () => {
      setResult(await saveBlockProps(fd));
    });
  }

  return (
    <form onSubmit={onSubmit} className="border-t border-dashed border-[var(--rule)] bg-[var(--paper)] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {def.fields
          .filter((f) => !f.startsWith("item"))
          .map((field) => (
            <label key={field} className="block text-xs">
              <span className="font-medium text-[var(--ink)]">{FIELD_LABEL[field] ?? field}</span>
              {field === "body" || field === "content" ? (
                <textarea
                  name={field}
                  rows={5}
                  className="mt-1 w-full border border-[var(--rule)] bg-white px-2 py-1.5 text-sm text-[var(--ink)]"
                />
              ) : field === "imagePosition" ? (
                <select
                  name={field}
                  defaultValue="kanan"
                  className="mt-1 w-full border border-[var(--rule)] bg-white px-2 py-1.5 text-sm"
                >
                  <option value="kanan">Kanan</option>
                  <option value="kiri">Kiri</option>
                  <option value="bawah">Bawah</option>
                </select>
              ) : field.startsWith("show") ? (
                <input
                  type="checkbox"
                  name={field}
                  defaultChecked
                  className="mt-1 block"
                />
              ) : (
                <input
                  type="text"
                  name={field}
                  className="mt-1 w-full border border-[var(--rule)] bg-white px-2 py-1.5 text-sm text-[var(--ink)]"
                />
              )}
            </label>
          ))}
      </div>

      {/* Item berulang untuk blok stats (label/nilai) dan faq (tanya/jawab). */}
      {blockKey === "stats" && <RepeatedItems names={["itemLabel", "itemValue"]} labels={["Nama angka", "Nilai"]} />}
      {blockKey === "faq" && <RepeatedItems names={["itemQuestion", "itemAnswer"]} labels={["Pertanyaan", "Jawaban"]} />}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="border-2 border-[var(--ink)] bg-[var(--marker)] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Menyimpan…" : "Simpan isi blok"}
        </button>
        {result && !result.ok && <span className="text-xs text-red-800">{result.error}</span>}
        {result?.ok && <span className="text-xs text-emerald-800">Tersimpan.</span>}
      </div>
    </form>
  );
}

/** Dua kolom input berulang (baris bisa ditambah/hapus). */
function RepeatedItems({ names, labels }: { names: [string, string]; labels: [string, string] }) {
  const [rows, setRows] = useState([0, 1, 2]);
  const nextId = rows.length ? Math.max(...rows) + 1 : 0;

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-[var(--ink)]">{labels[0]} berulang</p>
      <div className="mt-1 space-y-1">
        {rows.map((id) => (
          <div key={id} className="flex gap-1">
            <input
              name={names[0]}
              placeholder={labels[0]}
              aria-label={labels[0]}
              className="min-w-0 flex-1 border border-[var(--rule)] px-2 py-1 text-sm"
            />
            <input
              name={names[1]}
              placeholder={labels[1]}
              aria-label={labels[1]}
              className="min-w-0 flex-[2] border border-[var(--rule)] px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((x) => x !== id))}
              aria-label="Hapus baris"
              className="border border-[var(--rule)] px-2 text-xs"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setRows((r) => [...r, nextId])}
        className="mt-1 text-xs text-[var(--ink)] underline"
      >
        Tambah baris
      </button>
      <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
        Baris yang dikosongkan otomatis tidak ikut disimpan.
      </p>
    </div>
  );
}

/** Label manusiawi untuk nama field teknis. */
const FIELD_LABEL: Record<string, string> = {
  heading: "Judul bagian",
  subtitle: "Kalimat pengantar",
  title: "Judul",
  body: "Isi teks",
  content: "Isi halaman",
  imageUrl: "Alamat gambar",
  imagePosition: "Posisi gambar",
  ctaLabel: "Teks tombol",
  ctaHref: "Alamat tombol",
  cta2Label: "Tombol kedua",
  cta2Href: "Alamat tombol kedua",
  itemCount: "Jumlah yang ditampilkan",
  showPosition: "Tampilkan jabatan",
  showMap: "Tampilkan peta",
  showHours: "Tampilkan jam layanan",
};
