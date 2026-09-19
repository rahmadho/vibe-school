"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPage,
  deletePage,
  updatePage,
} from "@/app/(dashboard)/dashboard/website/actions";
import type { ActionResult } from "@/lib/action-result";

/**
 * Daftar + editor halaman kustom.
 *
 * Editor dibuat DI DALAM baris (inline), bukan halaman terpisah per halaman:
 * jumlah halaman sekolah biasanya sedikit (3–10), dan berpindah halaman untuk
 * tiap suntingan membuat pekerjaan terasa berat. Satu layar, satu alur.
 */

export type PageRow = {
  id: string;
  title: string;
  slug: string;
  content: string;
  showInNav: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  metaTitle: string;
  metaDescription: string;
  updatedAt: string;
};

export function PageList({ pages }: { pages: PageRow[] }) {
  const [creating, setCreating] = useState(pages.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--ink)] pb-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
            Halaman web
          </h2>
          <p className="mt-0.5 text-sm text-[var(--slate)]">
            Halaman tambahan di luar beranda — mis. Profil, Visi &amp; Misi,
            Sambutan Kepala Sekolah.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreating((v) => !v);
            setEditingId(null);
          }}
          className="border-2 border-[var(--ink)] bg-[var(--marker)] px-4 py-2 text-sm font-semibold text-[var(--ink)]"
        >
          {creating ? "Tutup form" : "Tambah halaman"}
        </button>
      </header>

      {creating && (
        <PageForm
          mode="create"
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {pages.length === 0 && !creating && (
        <div className="border-2 border-dashed border-[var(--chalk)] px-4 py-8 text-center">
          <p className="font-medium text-[var(--ink)]">Belum ada halaman</p>
          <p className="mt-1 text-sm text-[var(--slate)]">
            Tambahkan halaman pertama, misalnya “Visi &amp; Misi”.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {pages.map((p) => {
          const isEditing = editingId === p.id;
          return (
            <li
              key={p.id}
              className="border-2 border-[var(--chalk)] bg-white"
            >
              <div className="flex flex-wrap items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--ink)]">
                      {p.title}
                    </span>
                    {!p.isPublished && (
                      <span className="border border-[var(--chalk)] bg-[var(--paper)] px-1.5 py-0.5 text-[11px] text-[var(--slate)]">
                        draf
                      </span>
                    )}
                    {p.showInNav && p.isPublished && (
                      <span className="border border-[var(--marker)] bg-[var(--marker)]/30 px-1.5 py-0.5 text-[11px] text-[var(--ink)]">
                        di menu
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-[var(--slate)]">
                    /{p.slug}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(isEditing ? null : p.id);
                      setCreating(false);
                    }}
                    className="border border-[var(--chalk)] px-2 py-0.5 text-xs hover:border-[var(--ink)]"
                  >
                    {isEditing ? "Tutup" : "Ubah"}
                  </button>
                  <DeletePageButton id={p.id} title={p.title} />
                </div>
              </div>

              {isEditing && (
                <div className="border-t border-dashed border-[var(--chalk)] bg-[var(--paper)] p-3">
                  <PageForm
                    mode="edit"
                    initial={p}
                    onDone={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PageForm({
  mode,
  initial,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: PageRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [content, setContent] = useState(initial?.content ?? "");
  const [showInNav, setShowInNav] = useState(initial?.showInNav ?? true);
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [metaTitle, setMetaTitle] = useState(initial?.metaTitle ?? "");
  const [metaDesc, setMetaDesc] = useState(initial?.metaDescription ?? "");

  const fe = (n: string) => (!result || result.ok ? undefined : result.fieldErrors?.[n]?.[0]);

  /** Judul → alamat otomatis sampai operator menyentuh kolom alamat sendiri. */
  function onTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(toSlug(v));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    if (mode === "edit" && initial) fd.set("id", initial.id);
    fd.set("title", title);
    fd.set("slug", slug);
    fd.set("content", content);
    fd.set("showInNav", showInNav ? "on" : "");
    fd.set("isPublished", isPublished ? "on" : "");
    fd.set("metaTitle", metaTitle);
    fd.set("metaDescription", metaDesc);

    startTransition(async () => {
      const r = mode === "create" ? await createPage(fd) : await updatePage(fd);
      setResult(r);
      if (r.ok) router.refresh();
      if (r.ok) {
        if (mode === "create") onCancel();
        else onDone();
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={
        mode === "create"
          ? "border-2 border-[var(--ink)] bg-white p-4"
          : "space-y-3"
      }
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--ink)]">
          {mode === "create" ? "Halaman baru" : "Ubah halaman"}
        </h3>
      </div>

      {result && !result.ok && (
        <p className="mt-2 border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
          {result.error}
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Judul halaman" error={fe("title")}>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Visi dan Misi"
            className="w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
          />
        </Field>

        <Field
          label="Alamat halaman"
          hint="Huruf kecil, angka, tanda hubung. Muncul di akhir alamat web."
          error={fe("slug")}
        >
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm text-[var(--slate)]">/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              placeholder="visi-misi"
              className="w-full border border-[var(--chalk)] bg-white px-2 py-1.5 font-mono text-sm"
            />
          </div>
        </Field>
      </div>

      <div className="mt-3">
        <Field
          label="Isi halaman"
          hint="Teks biasa. Gunakan baris kosong antar paragraf."
          error={fe("content")}
        >
          <textarea
            rows={mode === "create" ? 6 : 5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      {/* Pilihan tampil */}
      <fieldset className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          Terbitkan halaman
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          <input
            type="checkbox"
            checked={showInNav}
            onChange={(e) => setShowInNav(e.target.checked)}
          />
          Tampilkan di menu navigasi
        </label>
      </fieldset>
      <p className="mt-1 text-[11px] text-[var(--slate)]">
        Halaman draf tidak dapat dibuka pengunjung. “Di menu” hanya berlaku untuk
        halaman yang sudah diterbitkan.
      </p>

      {/* SEO — dilipat agar tidak membebani layar utama */}
      <details className="mt-3 border border-[var(--chalk)] bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-[var(--ink)]">
          Pengaturan mesin pencari (opsional)
        </summary>
        <div className="mt-2 space-y-3">
          <Field label="Judul di hasil pencarian" error={fe("metaTitle")}>
            <input
              type="text"
              maxLength={120}
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              className="w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Deskripsi di hasil pencarian" error={fe("metaDescription")}>
            <textarea
              rows={2}
              maxLength={300}
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              className="w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
            />
          </Field>
        </div>
      </details>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="border-2 border-[var(--ink)] bg-[var(--marker)] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {pending
            ? "Menyimpan…"
            : mode === "create"
              ? "Tambah halaman"
              : "Simpan perubahan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Batal
        </button>
        {result && !result.ok && (
          <span className="text-xs text-red-800">Periksa kembali isian.</span>
        )}
      </div>
    </form>
  );
}

/** Tombol hapus dengan konfirmasi — halaman di-soft-delete, tetap bisa dipulihkan. */
function DeletePageButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deletePage(fd);
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-red-800 underline"
      >
        Hapus
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="text-[var(--slate)]">Hapus “{title}”?</span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="border border-red-700 px-1.5 py-0.5 text-red-800 disabled:opacity-50"
      >
        {pending ? "…" : "Ya"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="border border-[var(--chalk)] px-1.5 py-0.5"
      >
        Batal
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && (
        <span className="mt-1 block text-[11px] leading-snug text-[var(--slate)]">
          {hint}
        </span>
      )}
      {error && <span className="mt-1 block text-[11px] text-red-800">{error}</span>}
    </label>
  );
}

/** "Visi dan Misi" → "visi-dan-misi". */
function toSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}
