"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { Textarea } from "@/components/form-fields";
import { BLOCK_DEFINITIONS, getBlock, getVariant } from "@/lib/site-blocks";
import {
  fieldsForBlock,
  PAGE_BLOCK_FIELDS,
  type PageBlockField,
} from "@/lib/page-block-fields";
import { RichTextEditor } from "@/components/rich-text-editor";
import { MediaPicker, type PickerMedia } from "@/components/media-picker";
import { BlockIcon } from "./block-icon";

/**
 * Penyusun blok halaman kustom.
 *
 * ============================================================
 * KENAPA SATU KOLOM, BUKAN DUA PANEL BERDAMPINGAN
 * ============================================================
 * Operator sekolah bekerja dari ponsel sebanyak dari laptop. Dua panel
 * berdampingan (katalog di kiri, kanvas di kanan) memaksa layar lebar, dan di
 * ponsel harus diciutkan menjadi tumpukan yang justru membingungkan. Satu
 * kolom dengan katalog yang muncul saat diminta bekerja sama baiknya di
 * keduanya.
 *
 * ============================================================
 * KENAPA BLOK BOLEH BERULANG
 * ============================================================
 * Halaman kustom sering butuh blok yang sama lebih dari sekali: dua blok teks
 * (pembuka dan penutup), tiga blok gambar. Karena itu tiap instance punya `id`
 * sendiri — tanpa itu, menyunting blok kedua ikut mengubah yang pertama.
 *
 * ============================================================
 * KENAPA NAIK/TURUN, BUKAN GESER-LEPAS
 * ============================================================
 * Geser-lepas rapuh di layar sentuh dan tidak bisa dioperasikan pembaca layar.
 * Tombol naik/turun bekerja di mana saja, termasuk dengan keyboard.
 */

export type ComposerBlock = {
  id: string;
  blockKey: string;
  variantKey: string;
  order: number;
  isEnabled: boolean;
  props: Record<string, unknown>;
};

/** Buat pengenal blok. `randomUUID` ada di semua peramban modern. */
function newBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

/** Blok yang boleh dipakai di halaman kustom — hanya blok general. */
const COMPOSABLE_KEYS = new Set(Object.keys(PAGE_BLOCK_FIELDS));

export function BlockComposer({
  blocks,
  onChange,
  media,
}: {
  blocks: ComposerBlock[];
  onChange: (next: ComposerBlock[]) => void;
  /** Isi pustaka media untuk pemilih gambar. */
  media: PickerMedia[];
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  /** Katalog: hanya blok general yang punya form isian. */
  const catalog = BLOCK_DEFINITIONS.filter((d) => COMPOSABLE_KEYS.has(d.key));

  function reindex(list: ComposerBlock[]): ComposerBlock[] {
    return list.map((b, i) => ({ ...b, order: i }));
  }

  function addBlock(blockKey: string) {
    const def = getBlock(blockKey);
    if (!def) return;
    const block: ComposerBlock = {
      id: newBlockId(),
      blockKey,
      variantKey: def.defaultVariant,
      order: blocks.length,
      isEnabled: true,
      props: {},
    };
    onChange(reindex([...blocks, block]));
    setCatalogOpen(false);
    // Langsung buka blok baru — operator menambah blok untuk mengisinya,
    // bukan untuk melihatnya tergeletak kosong.
    setOpenId(block.id);
  }

  function removeBlock(id: string) {
    onChange(reindex(blocks.filter((b) => b.id !== id)));
    if (openId === id) setOpenId(null);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(reindex(next));
  }

  function duplicateBlock(id: string) {
    const src = blocks.find((b) => b.id === id);
    if (!src) return;
    const copy: ComposerBlock = {
      ...src,
      id: newBlockId(),
      // Salinan ditempatkan tepat setelah aslinya, bukan di paling bawah —
      // operator menyalin untuk variasi berdekatan, bukan untuk pindah ujung.
      order: src.order + 0.5,
      props: JSON.parse(JSON.stringify(src.props)) as Record<string, unknown>,
    };
    const next = [...blocks, copy];
    next.sort((a, b) => a.order - b.order);
    onChange(reindex(next));
  }

  function toggleEnabled(id: string) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, isEnabled: !b.isEnabled } : b)));
  }

  function updateBlock(id: string, patch: Partial<ComposerBlock>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  const enabledCount = blocks.filter((b) => b.isEnabled).length;

  return (
    <div className="space-y-3">
      {/* ---- Bilah atas ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--chalk)] pb-3">
        <p className="text-sm text-[var(--slate)]">
          {blocks.length === 0
            ? "Belum ada blok. Halaman ini akan memakai isi teks biasa."
            : `${blocks.length} blok · ${enabledCount} aktif`}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setCatalogOpen((v) => !v)}
        >
          {catalogOpen ? "Tutup katalog" : "Tambah blok"}
        </Button>
      </div>

      {/* ---- Katalog ---- */}
      {catalogOpen ? (
        <div className="border-2 border-[var(--ink)] bg-white p-3">
          <p className="mb-3 text-xs text-[var(--slate)]">
            Pilih jenis blok. Blok yang sama boleh dipakai lebih dari sekali.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((def) => (
              <li key={def.key}>
                <button
                  type="button"
                  onClick={() => addBlock(def.key)}
                  className="flex w-full items-start gap-3 border border-[var(--chalk)] p-3 text-left transition-colors hover:border-[var(--ink)] hover:bg-[var(--paper)]"
                >
                  <span className="mt-0.5 shrink-0 text-[var(--slate)]">
                    <BlockIcon name={def.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--ink)]">
                      {def.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--slate)]">
                      {def.description}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---- Daftar blok ---- */}
      {blocks.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--chalk)] bg-white px-6 py-10 text-center">
          <p className="font-display text-lg text-[var(--ink)]">
            Halaman masih kosong
          </p>
          <p className="mx-auto mt-1 max-w-prose text-sm text-[var(--slate)]">
            Susun halaman dari blok — teks, gambar, tabel, langkah, dan lainnya.
            Bisa juga dibiarkan kosong dan memakai isi teks biasa di bawah.
          </p>
          <div className="mt-4">
            <Button type="button" onClick={() => setCatalogOpen(true)}>
              Tambah blok pertama
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {blocks.map((block, index) => {
            const def = getBlock(block.blockKey);
            const variant = getVariant(block.variantKey);
            const open = openId === block.id;

            return (
              <li
                key={block.id}
                className={[
                  "border-2 bg-white",
                  open ? "border-[var(--ink)]" : "border-[var(--chalk)]",
                  block.isEnabled ? "" : "opacity-60",
                ].join(" ")}
              >
                {/* ---- Kepala blok ---- */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="shrink-0 text-[var(--slate)]">
                    <BlockIcon name={def?.icon ?? "text"} />
                  </span>

                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : block.id)}
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={open}
                  >
                    <span className="block truncate text-sm font-medium text-[var(--ink)]">
                      {def?.name ?? block.blockKey}
                    </span>
                    <span className="block truncate text-xs text-[var(--slate)]">
                      {variant?.variant.label ?? block.variantKey}
                      {!block.isEnabled ? " · disembunyikan" : ""}
                    </span>
                  </button>

                  {/* Tombol urutan — selalu tampak, bukan hanya saat disorot,
                      karena di layar sentuh tidak ada "sorot". */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton
                      label="Naikkan"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      icon="up"
                    />
                    <IconButton
                      label="Turunkan"
                      disabled={index === blocks.length - 1}
                      onClick={() => move(index, 1)}
                      icon="down"
                    />
                    <IconButton
                      label={block.isEnabled ? "Sembunyikan" : "Tampilkan"}
                      onClick={() => toggleEnabled(block.id)}
                      icon={block.isEnabled ? "eye" : "eyeOff"}
                    />
                    <IconButton
                      label="Duplikat"
                      onClick={() => duplicateBlock(block.id)}
                      icon="copy"
                    />
                    <IconButton
                      label="Hapus"
                      onClick={() => removeBlock(block.id)}
                      icon="trash"
                      danger
                    />
                  </div>
                </div>

                {/* ---- Isi blok (dibuka saat diminta) ---- */}
                {open ? (
                  <BlockEditor
                    block={block}
                    media={media}
                    onPatch={(patch) => updateBlock(block.id, patch)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ============================================================
 * TOMBOL IKON
 * ============================================================ */

function IconButton({
  label,
  icon,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-7 w-7 items-center justify-center transition-colors",
        disabled
          ? "cursor-not-allowed text-[var(--chalk)]"
          : danger
            ? "text-[var(--slate)] hover:bg-red-50 hover:text-[var(--marker)]"
            : "text-[var(--slate)] hover:bg-[var(--paper)] hover:text-[var(--ink)]",
      ].join(" ")}
    >
      <BlockIcon name={icon} />
    </button>
  );
}

/* ============================================================
 * EDITOR ISI BLOK
 * ============================================================ */

function BlockEditor({
  block,
  media,
  onPatch,
}: {
  block: ComposerBlock;
  media: PickerMedia[];
  onPatch: (patch: Partial<ComposerBlock>) => void;
}) {
  const def = getBlock(block.blockKey);
  const fields = fieldsForBlock(block.blockKey);

  function setProp(key: string, value: unknown) {
    onPatch({ props: { ...block.props, [key]: value } });
  }

  if (!def) return null;

  return (
    <div className="space-y-4 border-t border-dashed border-[var(--chalk)] bg-[var(--paper)] p-3">
      {/* ---- Varian gaya ---- */}
      {def.variants.length > 1 ? (
        <label className="block text-xs">
          <span className="font-medium text-[var(--ink)]">Gaya tampilan</span>
          <select
            value={block.variantKey}
            onChange={(e) => onPatch({ variantKey: e.target.value })}
            className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
          >
            {def.variants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label} — {v.hint}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* ---- Kolom isian ---- */}
      {fields.length === 0 ? (
        <p className="text-sm text-[var(--slate)]">
          Blok ini belum punya form isian.
        </p>
      ) : (
        <div className="space-y-4">
          {fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={block.props[field.key]}
              media={media}
              onChange={(v) => setProp(field.key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * SATU KOLOM ISIAN
 * ============================================================ */

function FieldInput({
  field,
  value,
  media,
  onChange,
}: {
  field: PageBlockField;
  value: unknown;
  media: PickerMedia[];
  onChange: (v: unknown) => void;
}) {
  const label = (
    <span className="block text-xs font-medium text-[var(--ink)]">
      {field.label}
    </span>
  );
  const hint = field.hint ? (
    <span className="mt-0.5 block text-[11px] text-[var(--slate)]">{field.hint}</span>
  ) : null;

  if (field.kind === "richtext") {
    return (
      <div>
        {label}
        {hint}
        <div className="mt-1">
          <RichTextEditor
            value={typeof value === "string" ? value : ""}
            onChange={(html) => onChange(html)}
            placeholder={field.placeholder ?? "Tulis di sini…"}
          />
        </div>
      </div>
    );
  }

  if (field.kind === "textarea") {
    return (
      <label className="block">
        {label}
        {hint}
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="mt-1"
        />
      </label>
    );
  }

  if (field.kind === "image") {
    return (
      <MediaPicker
        value={typeof value === "string" ? value : ""}
        onChange={(url) => onChange(url)}
        media={media}
        label={field.label}
      />
    );
  }

  if (field.kind === "list") {
    return <ListInput field={field} value={value} media={media} onChange={onChange} />;
  }

  return (
    <label className="block">
      {label}
      {hint}
      <Input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="mt-1"
      />
    </label>
  );
}

/* ============================================================
 * DAFTAR BERULANG
 * ============================================================ */

function ListInput({
  field,
  value,
  media,
  onChange,
}: {
  field: PageBlockField;
  value: unknown;
  media: PickerMedia[];
  onChange: (v: unknown) => void;
}) {
  const items: Record<string, string>[] = Array.isArray(value)
    ? value
        .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
        .map((v) => {
          const out: Record<string, string> = {};
          for (const [k, val] of Object.entries(v)) {
            out[k] = val === null || val === undefined ? "" : String(val);
          }
          return out;
        })
    : [];

  const itemFields = field.itemFields ?? [];
  const max = field.maxItems ?? 20;
  const atLimit = items.length >= max;

  function update(index: number, key: string, v: string) {
    const next = items.map((it, i) => (i === index ? { ...it, [key]: v } : it));
    onChange(next);
  }

  function add() {
    if (atLimit) return;
    const blank: Record<string, string> = {};
    for (const f of itemFields) blank[f.key] = "";
    onChange([...items, blank]);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const t = index + dir;
    if (t < 0 || t >= items.length) return;
    const next = [...items];
    [next[index], next[t]] = [next[t], next[index]];
    onChange(next);
  }

  return (
    <div>
      <span className="block text-xs font-medium text-[var(--ink)]">{field.label}</span>
      {field.hint ? (
        <span className="mt-0.5 block text-[11px] text-[var(--slate)]">{field.hint}</span>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="border border-[var(--chalk)] bg-white p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--slate)]">
                  {field.itemLabel ?? "Item"} {i + 1}
                </span>
                <div className="flex items-center gap-0.5">
                  <IconButton
                    label="Naikkan"
                    icon="up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  />
                  <IconButton
                    label="Turunkan"
                    icon="down"
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                  />
                  <IconButton
                    label="Hapus"
                    icon="trash"
                    danger
                    onClick={() => remove(i)}
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {itemFields.map((f) => (
                  <label key={f.key} className={f.kind === "textarea" ? "block sm:col-span-2" : "block"}>
                    <span className="block text-[11px] text-[var(--slate)]">{f.label}</span>
                    {f.kind === "textarea" ? (
                      <Textarea
                        value={item[f.key] ?? ""}
                        onChange={(e) => update(i, f.key, e.target.value)}
                        rows={2}
                        className="mt-0.5"
                      />
                    ) : f.kind === "image" ? (
                      <div className="mt-0.5">
                        <MediaPicker
                          value={item[f.key] ?? ""}
                          onChange={(url) => update(i, f.key, url)}
                          media={media}
                          label={f.label}
                        />
                      </div>
                    ) : (
                      <Input
                        value={item[f.key] ?? ""}
                        onChange={(e) => update(i, f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="mt-0.5"
                      />
                    )}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs italic text-[var(--slate)]">
          Belum ada {field.itemLabel?.toLowerCase() ?? "item"}.
        </p>
      )}

      <div className="mt-2">
        <Button type="button" variant="ghost" onClick={add} disabled={atLimit}>
          {atLimit ? `Maksimal ${max} tercapai` : `Tambah ${field.itemLabel?.toLowerCase() ?? "item"}`}
        </Button>
      </div>
    </div>
  );
}
