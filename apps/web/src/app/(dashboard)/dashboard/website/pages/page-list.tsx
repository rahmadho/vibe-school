"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPage,
  deletePage,
  updatePage,
} from "@/app/(dashboard)/dashboard/website/actions";
import type { ActionResult } from "@/lib/action-result";
import { Button, Field, Input } from "@/components/ui";
import { FormError } from "@/components/form-fields";
import { RichTextEditor } from "@/components/rich-text-editor";
import { BlockComposer, type ComposerBlock } from "./block-composer";
import { BlockIcon } from "./block-icon";
import { PAGE_BLOCK_FIELDS } from "@/lib/page-block-fields";
import { getBlock } from "@/lib/site-blocks";
import type { PickerMedia } from "@/components/media-picker";

/**
 * Daftar & editor halaman kustom.
 *
 * ============================================================
 * ARAH DESAIN — INDEKS ARSIP, BUKAN TUMPUKAN KOTAK
 * ============================================================
 * Sebelumnya setiap halaman adalah kotak berbingkai dengan isi yang sama
 * persis: judul, alamat, dua tombol. Sepuluh halaman berarti sepuluh kotak
 * identik — mata tidak punya tempat berpijak, dan tidak ada cara melihat mana
 * yang sudah lengkap dan mana yang masih kerangka.
 *
 * Halaman sekolah pada dasarnya adalah ARSIP: daftar yang tumbuh pelan,
 * dibuka berulang, dan isinya perlu dikenali sekilas. Karena itu daftarnya
 * disusun seperti indeks arsip:
 *
 *   - Nomor urut di kiri sebagai jangkar mata (Fraunces, angka besar) —
 *     memudahkan menyebut "halaman nomor 3" saat menelepon staf lain.
 *   - Judul sebagai teks terbesar; alamat sebagai baris tipis di bawahnya.
 *   - Status dibaca sebagai KATA, bukan lencana berwarna di mana-mana.
 *     Lencana yang muncul di setiap baris berhenti menjadi informasi.
 *   - Satu baris isi: berapa blok, atau berapa kata — supaya terlihat mana
 *     yang sudah diisi dan mana yang baru dibuka.
 *
 * ============================================================
 * KENAPA EDITOR TETAP DI DALAM BARIS
 * ============================================================
 * Jumlah halaman sekolah sedikit (3–10). Berpindah halaman untuk tiap
 * suntingan membuat pekerjaan terasa berat: menambah satu paragraf berarti
 * keluar-masuk, dan kehilangan tempat di daftar. Satu layar, satu alur.
 */

export type PageRow = {
  id: string;
  title: string;
  slug: string;
  content: string;
  blocks: ComposerBlock[];
  showInNav: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  metaTitle: string;
  metaDescription: string;
  updatedAt: string;
};

export function PageList({
  pages,
  media,
}: {
  pages: PageRow[];
  /** Isi pustaka media untuk pemilih gambar di dalam blok. */
  media: PickerMedia[];
}) {
  const [creating, setCreating] = useState(pages.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[var(--ink)] pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
            Halaman web
          </h1>
          <p className="mt-1 max-w-prose text-sm text-[var(--slate)]">
            Halaman tambahan di luar beranda — Profil, Visi &amp; Misi,
            Sambutan Kepala Sekolah. Susun dari blok, atau tulis sebagai teks.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating((v) => !v);
            setEditingId(null);
          }}
        >
          {creating ? "Tutup form" : "Tambah halaman"}
        </Button>
      </header>

      {creating ? (
        <section className="border-2 border-[var(--ink)] bg-white">
          <div className="border-b border-[var(--chalk)] px-4 py-2.5">
            <h2 className="font-display text-lg text-[var(--ink)]">Halaman baru</h2>
          </div>
          <div className="p-4">
            <PageForm
              mode="create"
              media={media}
              onDone={() => setCreating(false)}
              onCancel={() => setCreating(false)}
            />
          </div>
        </section>
      ) : null}

      {pages.length === 0 && !creating ? (
        <EmptyPages onAdd={() => setCreating(true)} />
      ) : (
        <ol className="border-t border-[var(--chalk)]">
          {pages.map((p, index) => {
            const isEditing = editingId === p.id;
            return (
              <li key={p.id} className="border-b border-[var(--chalk)]">
                <PageRowView
                  page={p}
                  index={index}
                  isEditing={isEditing}
                  onToggle={() => {
                    setEditingId(isEditing ? null : p.id);
                    setCreating(false);
                  }}
                />

                {isEditing ? (
                  <div className="border-t border-dashed border-[var(--chalk)] bg-[var(--paper)] px-4 py-4">
                    <PageForm
                      mode="edit"
                      initial={p}
                      media={media}
                      onDone={() => setEditingId(null)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ============================================================
 * SATU BARIS ARSIP
 * ============================================================ */

function PageRowView({
  page,
  index,
  isEditing,
  onToggle,
}: {
  page: PageRow;
  index: number;
  isEditing: boolean;
  onToggle: () => void;
}) {
  const blockCount = page.blocks.length;
  const enabledBlocks = page.blocks.filter((b) => b.isEnabled).length;
  const wordCount = countWords(page.content);
  const usesBlocks = blockCount > 0;

  // Nama blok pertama dipakai sebagai ringkasan isi — "Teks · Gambar · Tabel"
  // jauh lebih berguna daripada "4 blok" saja.
  const blockSummary = page.blocks
    .filter((b) => b.isEnabled)
    .slice(0, 4)
    .map((b) => getBlock(b.blockKey)?.name ?? b.blockKey)
    .join(" · ");

  return (
    <div
      className={[
        "flex items-start gap-4 px-2 py-4 transition-colors",
        isEditing ? "bg-[var(--paper)]" : "hover:bg-[var(--paper)]/60",
      ].join(" ")}
    >
      {/* Nomor urut — jangkar mata, bukan sekadar hiasan. */}
      <span
        aria-hidden
        className="tabular-display w-10 shrink-0 pt-0.5 text-right text-[var(--chalk)]"
        style={{ fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)" }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isEditing}
        className="min-w-0 flex-1 text-left"
      >
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-lg leading-snug text-[var(--ink)]">
            {page.title}
          </span>

          {/* Status sebagai KATA. Tanpa lencana berwarna agar tidak bersaing
              dengan judul — yang penting dibaca lebih dulu adalah nama. */}
          {!page.isPublished ? (
            <span className="text-xs uppercase tracking-[0.14em] text-[var(--slate)]">
              draf
            </span>
          ) : page.showInNav ? (
            <span className="text-xs uppercase tracking-[0.14em] text-[var(--slate)]">
              di menu
            </span>
          ) : null}
        </span>

        <span className="mt-0.5 block font-mono text-xs text-[var(--slate)]">
          /{page.slug}
        </span>

        {/* Ringkasan isi — inilah yang membedakan "sudah diisi" dari "baru
            dibuka". Tanpa baris ini, semua halaman tampak sama. */}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--slate)]">
          {usesBlocks ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <BlockIcon name="cards" className="h-3.5 w-3.5" />
                {enabledBlocks} blok
              </span>
              {blockSummary ? <span>· {blockSummary}</span> : null}
              {blockCount !== enabledBlocks ? (
                <span>· {blockCount - enabledBlocks} disembunyikan</span>
              ) : null}
            </>
          ) : wordCount > 0 ? (
            <span>{wordCount} kata</span>
          ) : (
            <span className="text-[var(--marker)]">belum diisi</span>
          )}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={onToggle}
          className="border border-[var(--chalk)] px-2.5 py-1 text-xs text-[var(--ink)] transition-colors hover:border-[var(--ink)]"
        >
          {isEditing ? "Tutup" : "Ubah"}
        </button>
        <DeletePageButton id={page.id} title={page.title} />
      </div>
    </div>
  );
}

/* ============================================================
 * KEADAAN KOSONG
 * ============================================================ */

function EmptyPages({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="border-2 border-dashed border-[var(--chalk)] bg-white px-6 py-12 text-center">
      <p className="font-display text-xl text-[var(--ink)]">Belum ada halaman</p>
      <p className="mx-auto mt-2 max-w-prose text-sm text-[var(--slate)]">
        Halaman tambahan muncul di alamat{" "}
        <span className="font-mono text-[var(--ink)]">/nama-halaman</span> dan
        bisa ditautkan ke menu atas. Mulai dari yang paling sering dicari orang
        tua, misalnya &ldquo;Visi &amp; Misi&rdquo; atau &ldquo;Biaya
        Pendidikan&rdquo;.
      </p>
      <div className="mt-5">
        <Button onClick={onAdd}>Tambah halaman pertama</Button>
      </div>
    </div>
  );
}

/* ============================================================
 * FORM HALAMAN
 * ============================================================ */

type EditorMode = "text" | "blocks";

function PageForm({
  mode,
  initial,
  media,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: PageRow;
  media: PickerMedia[];
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
  const [blocks, setBlocks] = useState<ComposerBlock[]>(initial?.blocks ?? []);
  const [showInNav, setShowInNav] = useState(initial?.showInNav ?? true);
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [metaTitle, setMetaTitle] = useState(initial?.metaTitle ?? "");
  const [metaDesc, setMetaDesc] = useState(initial?.metaDescription ?? "");

  // Mode awal mengikuti isi yang sudah ada. Halaman berblok dibuka dalam mode
  // blok — memaksa operator memilih ulang setiap kali membuka itu melelahkan.
  const [editorMode, setEditorMode] = useState<EditorMode>(
    (initial?.blocks.length ?? 0) > 0 ? "blocks" : "text",
  );

  const [showSeo, setShowSeo] = useState(
    Boolean(initial?.metaTitle || initial?.metaDescription),
  );

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
    // Mode menentukan mana yang dikirim: teks saja, atau blok saja. Mengirim
    // keduanya berarti halaman menyimpan isi yang tidak pernah terlihat —
    // dan operator bingung kenapa suntingannya "hilang" saat berganti mode.
    fd.set("content", editorMode === "text" ? content : "");
    fd.set("blocks", editorMode === "blocks" ? JSON.stringify(blocks) : "[]");
    if (showInNav) fd.set("showInNav", "on");
    if (isPublished) fd.set("isPublished", "on");
    fd.set("metaTitle", metaTitle);
    fd.set("metaDescription", metaDesc);

    startTransition(async () => {
      const r = mode === "create" ? await createPage(fd) : await updatePage(fd);
      setResult(r);
      if (r.ok) {
        router.refresh();
        if (mode === "create") onCancel();
        else onDone();
      }
    });
  }

  const blockCount = blocks.length;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError message={result && !result.ok ? result.error : null} />

      {/* ---- Identitas ---- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Judul halaman" htmlFor="title" error={fe("title")}>
          <Input
            id="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Visi & Misi"
            required
          />
        </Field>

        <Field
          label="Alamat halaman"
          htmlFor="slug"
          error={fe("slug")}
          hint={slug ? `Akan dibuka di /${slug}` : "Terisi otomatis dari judul."}
        >
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className="font-mono"
            placeholder="visi-misi"
            required
          />
        </Field>
      </div>

      {/* ---- Cara menyusun ---- */}
      <div>
        <span className="mb-2 block text-sm font-medium text-[var(--ink)]">
          Cara menyusun halaman
        </span>
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeCard
            active={editorMode === "blocks"}
            onClick={() => setEditorMode("blocks")}
            title="Susun dari blok"
            description="Teks, gambar, tabel, langkah, dan lainnya dalam urutan bebas. Paling rapi untuk halaman yang punya banyak bagian."
            badge={blockCount > 0 ? `${blockCount} blok` : "belum ada blok"}
          />
          <ModeCard
            active={editorMode === "text"}
            onClick={() => setEditorMode("text")}
            title="Tulis sebagai teks"
            description="Satu kolom tulisan. Paling cepat untuk halaman yang isinya murni cerita, seperti Sejarah Sekolah."
            badge={content.trim() ? `${countWords(content)} kata` : "belum diisi"}
          />
        </div>
      </div>

      {/* ---- Isi sesuai mode ---- */}
      {editorMode === "blocks" ? (
        <BlockComposer blocks={blocks} onChange={setBlocks} media={media} />
      ) : (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">
            Isi halaman
          </span>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Tulis isi halaman di sini…"
          />
          {fe("content") ? (
            <span className="mt-1 block text-sm text-[var(--marker)]">
              {fe("content")}
            </span>
          ) : null}
        </div>
      )}

      {/* ---- Penerbitan ---- */}
      <fieldset className="space-y-3 border-t border-[var(--chalk)] pt-4">
        <legend className="sr-only">Penerbitan</legend>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--board)]"
          />
          <span>
            <span className="block text-sm font-medium text-[var(--ink)]">
              Terbitkan halaman
            </span>
            <span className="mt-0.5 block text-xs text-[var(--slate)]">
              Halaman yang belum diterbitkan hanya bisa dilihat dari dasbor.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={showInNav}
            onChange={(e) => setShowInNav(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--board)]"
          />
          <span>
            <span className="block text-sm font-medium text-[var(--ink)]">
              Tampilkan di menu atas
            </span>
            <span className="mt-0.5 block text-xs text-[var(--slate)]">
              Alamat tetap bisa dibuka walau tidak masuk menu.
            </span>
          </span>
        </label>
      </fieldset>

      {/* ---- SEO: disembunyikan sampai dibutuhkan ---- */}
      <div className="border-t border-[var(--chalk)] pt-4">
        <button
          type="button"
          onClick={() => setShowSeo((v) => !v)}
          aria-expanded={showSeo}
          className="text-sm text-[var(--slate)] underline-offset-4 hover:text-[var(--ink)] hover:underline"
        >
          {showSeo ? "Sembunyikan pengaturan mesin pencari" : "Atur judul di mesin pencari (opsional)"}
        </button>

        {showSeo ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field
              label="Judul di Google"
              htmlFor="metaTitle"
              error={fe("metaTitle")}
              hint="Kosongkan untuk memakai judul halaman."
            >
              <Input
                id="metaTitle"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
              />
            </Field>
            <Field
              label="Deskripsi di Google"
              htmlFor="metaDescription"
              error={fe("metaDescription")}
              hint="Satu-dua kalimat yang muncul di hasil pencarian."
            >
              <Input
                id="metaDescription"
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
              />
            </Field>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--chalk)] pt-4">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Menyimpan…"
            : mode === "create"
              ? "Simpan halaman"
              : "Simpan perubahan"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Batal
        </Button>
        {result?.ok ? (
          <span className="text-sm text-[var(--board)]">Tersimpan.</span>
        ) : null}
      </div>
    </form>
  );
}

/* ============================================================
 * KARTU PEMILIH MODE
 * ============================================================ */

function ModeCard({
  active,
  onClick,
  title,
  description,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "border-2 p-3 text-left transition-colors",
        active
          ? "border-[var(--ink)] bg-[var(--paper)]"
          : "border-[var(--chalk)] bg-white hover:border-[var(--slate)]",
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--ink)]">{title}</span>
        <span
          className={[
            "shrink-0 text-[11px] tabular-nums",
            active ? "text-[var(--board)]" : "text-[var(--slate)]",
          ].join(" ")}
        >
          {badge}
        </span>
      </span>
      <span className="mt-1 block text-xs leading-snug text-[var(--slate)]">
        {description}
      </span>
    </button>
  );
}

/* ============================================================
 * TOMBOL HAPUS
 * ============================================================ */

function DeletePageButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const r = await deletePage(fd);
      if (r.ok) {
        router.refresh();
        setConfirming(false);
      } else {
        setError(r.error);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="border border-[var(--chalk)] px-2.5 py-1 text-xs text-[var(--slate)] transition-colors hover:border-[var(--marker)] hover:text-[var(--marker)]"
      >
        Hapus
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      {error ? <span className="text-xs text-[var(--marker)]">{error}</span> : null}
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="border border-[var(--marker)] px-2 py-1 text-xs text-[var(--marker)] disabled:opacity-50"
      >
        {pending ? "Menghapus…" : `Hapus "${title}"?`}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-xs text-[var(--slate)] hover:underline"
      >
        Batal
      </button>
    </span>
  );
}

/* ============================================================
 * PEMBANTU
 * ============================================================ */

/** Judul → alamat URL. */
function toSlug(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/** Hitung kata dari HTML — untuk meringkas isi mode teks. */
function countWords(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}
