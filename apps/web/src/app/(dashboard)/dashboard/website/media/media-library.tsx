"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, cx } from "@/components/ui";
import { Select } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import {
  uploadMedia,
  linkMedia,
  deleteMedia,
  deleteMediaBulk,
  updateMedia,
} from "./actions";

/**
 * Media manager — pustaka berkas web sekolah.
 *
 * ============================================================
 * KENAPA SATU PANEL TAMBAH, BUKAN DUA TOMBOL TERPISAH
 * ============================================================
 * Operator sering belum tahu berkasnya ada di mana saat membuka halaman ini:
 * kadang sudah tersimpan di laptop, kadang masih berupa tautan dari grup
 * WhatsApp. Dua tombol terpisah memaksa memilih lebih dulu. Satu panel dengan
 * dua tab membuat pilihan itu terjadi setelah melihat isinya.
 *
 * ============================================================
 * KENAPA TIDAK MEMAKAI MODAL
 * ============================================================
 * Mengunggah berkas butuh menyeret, melihat pratinjau, dan kadang mengulang.
 * Modal mengunci sisa halaman sehingga operator kehilangan konteks berkas apa
 * saja yang sudah ada. Panel ini tumbuh di tempat, dan galeri tetap terlihat.
 *
 * ============================================================
 * KENAPA HANYA PNG/JPEG/WEBP
 * ============================================================
 * SVG ditolak di seluruh aplikasi: XML boleh memuat `<script>`, dan berkas itu
 * tampil di halaman publik sekolah. Batas 2 MB juga disengaja — foto dari
 * ponsel perlu dikecilkan dulu, dan itu memaksa operator berpikir tentang
 * ukuran halaman web sekolahnya.
 */

const MAX_MB = 2;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Ukuran berkas besar ditandai agar operator tahu apa yang memberatkan web. */
const LARGE_BYTES = 300 * 1024;

/**
 * Ambil pesan dari `ActionResult`.
 *
 * `ActionResult` adalah union: `{ok:true, message?}` atau `{ok:false, error}`.
 * TypeScript hanya mengizinkan akses field setelah jenisnya dipersempit —
 * karena itu pengecekan `ok` ada di sini, sekali, bukan diulang di pemanggil.
 */
function noticeText(res: ActionResult): string {
  return res.ok ? (res.message ?? "Selesai.") : res.error;
}

export type MediaItem = {
  id: string;
  name: string;
  url: string;
  /** Ukuran byte. 0 untuk tautan luar (tidak pernah diunduh). */
  bytes: number;
  width: number | null;
  height: number | null;
  uploadedAt: string;
  /** "UPLOAD" = berkas milik kita; "LINK" = tautan ke server lain. */
  source: "UPLOAD" | "LINK";
  /** Tempat berkas ini dipakai, mis. "Berita: Upacara HUT RI". */
  usage: string[];
  altText: string | null;
};

export type MediaStats = {
  total: number;
  uploads: number;
  links: number;
  unused: number;
  totalBytes: number;
};

/* ============================================================
 * BANTUAN
 * ============================================================ */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}


/* ============================================================
 * IKON — SVG sebaris, bukan emoji, bukan pustaka
 * ============================================================ */

const ICONS: Record<string, string> = {
  upload: "M12 15.5V4.5M8 8l4-3.5L16 8M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3",
  link: "M10.2 13.4a4.6 4.6 0 0 0 6.6 0l2.2-2.2a4.6 4.6 0 0 0-6.6-6.6l-1 1M13.8 10.6a4.6 4.6 0 0 0-6.6 0L5 12.8a4.6 4.6 0 0 0 6.6 6.6l1-1",
  grid: "M4 4.5h6.5v6.5H4zM13.5 4.5H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  list: "M4 6.5h16M4 12h16M4 17.5h16",
  close: "m6 6 12 12M18 6 6 18",
  search: "M11 18.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16.5 16.5 21 21",
  trash: "M4.5 6.5h15M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7M6.5 6.5l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12",
  copy: "M9 9h9.5v9.5a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5V10.5A1.5 1.5 0 0 1 9 9zM5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5",
  check: "m5 12.5 4.5 4.5L19 7",
  image:
    "M4 5.5h16v13H4zM4 15l4.5-4.5 3.5 3.5 3-3 5 5M15.5 9.5h.02",
};

function Icon({ name, className }: { name: string; className?: string }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("h-4 w-4 shrink-0", className)}
    >
      <path d={d} />
    </svg>
  );
}

/* ============================================================
 * KOMPONEN UTAMA
 * ============================================================ */

export function MediaLibrary({
  initialItems,
  stats,
}: {
  initialItems: MediaItem[];
  stats: MediaStats;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(
    null,
  );

  // --- Panel tambah: berkas lokal ---
  const [dragging, setDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  // --- Panel tambah: tautan ---
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkPreviewOk, setLinkPreviewOk] = useState<boolean | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Objek URL pratinjau harus dilepas; kalau tidak, memori browser menahan
  // berkas yang sudah tidak dipakai.
  const objectUrls = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      for (const u of objectUrls.current) URL.revokeObjectURL(u);
    };
  }, []);

  // Daftar dari server berubah setelah setiap aksi (router.refresh), jadi
  // state lokal harus mengikutinya.
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q) && !i.url.toLowerCase().includes(q))
        return false;
      if (filter === "used" && i.usage.length === 0) return false;
      if (filter === "unused" && i.usage.length > 0) return false;
      if (filter === "large" && i.bytes < LARGE_BYTES) return false;
      if (filter === "link" && i.source !== "LINK") return false;
      if (filter === "upload" && i.source !== "UPLOAD") return false;
      return true;
    });
  }, [items, query, filter]);

  /* ---------- Berkas lokal ---------- */

  function acceptFiles(files: FileList | File[]) {
    setLocalError(null);
    const list = Array.from(files);
    const ok: File[] = [];
    const rejected: string[] = [];

    for (const f of list) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        rejected.push(`${f.name} (format tidak didukung)`);
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        rejected.push(`${f.name} (${formatBytes(f.size)}, maksimal ${MAX_MB} MB)`);
        continue;
      }
      ok.push(f);
    }

    if (rejected.length) {
      setLocalError(`Ditolak: ${rejected.join(", ")}`);
    }
    if (ok.length) setPendingFiles((p) => [...p, ...ok]);
  }

  function removePending(index: number) {
    setPendingFiles((p) => p.filter((_, i) => i !== index));
  }

  /** Kirim semua berkas tunggu ke server, satu per satu. */
  function commitPending() {
    if (pendingFiles.length === 0) return;
    const files = pendingFiles;

    startTransition(async () => {
      let ok = 0;
      const failed: string[] = [];

      for (const file of files) {
        const fd = new FormData();
        fd.set("file", file);
        const res = await uploadMedia(fd);
        if (res.ok) ok += 1;
        else failed.push(`${file.name}: ${res.error}`);
      }

      setPendingFiles([]);
      setAdding(false);
      setNotice(
        failed.length === 0
          ? { tone: "ok", text: `${ok} berkas ditambahkan.` }
          : { tone: "warn", text: `${ok} berhasil, ${failed.length} gagal — ${failed[0]}` },
      );
      router.refresh();
    });
  }

  /* ---------- Tautan ---------- */

  const linkValid = /^https?:\/\/.+/i.test(linkUrl.trim());

  function commitLink() {
    if (!linkValid) return;
    const fd = new FormData();
    fd.set("url", linkUrl.trim());
    fd.set("name", linkName.trim());

    startTransition(async () => {
      const res = await linkMedia(fd);
      if (res.ok) {
        setLinkUrl("");
        setLinkName("");
        setLinkPreviewOk(null);
        setAdding(false);
      }
      setNotice({
        tone: res.ok ? "ok" : "warn",
        text: res.ok ? (res.message ?? "Selesai.") : res.error,
      });
      router.refresh();
    });
  }

  /* ---------- Pilihan ganda ---------- */

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeChecked() {
    const ids = Array.from(checked);
    startTransition(async () => {
      const res = await deleteMediaBulk(ids);
      setChecked(new Set());
      if (selectedId && ids.includes(selectedId)) setSelectedId(null);
      setNotice({
        tone: res.ok ? "ok" : "warn",
        text: noticeText(res),
      });
      router.refresh();
    });
  }

  function removeOne(id: string) {
    startTransition(async () => {
      const res = await deleteMedia(id);
      if (res.ok) setSelectedId(null);
      setNotice({
        tone: res.ok ? "ok" : "warn",
        text: noticeText(res),
      });
      router.refresh();
    });
  }

  /* ---------- Ringkasan ---------- */

  const totalBytes = stats.totalBytes;
  const unusedCount = stats.unused;

  return (
    <div className="space-y-5">
      {/* ---------- Kepala ---------- */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[var(--ink)] pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
            Media
          </h1>
          <p className="mt-1 text-sm text-[var(--slate)]">
            {stats.total} berkas · {formatBytes(totalBytes)} tersimpan
            {unusedCount > 0 ? ` · ${unusedCount} belum dipakai` : ""}
          </p>
        </div>
        <Button onClick={() => setAdding((a) => !a)} disabled={pending}>
          {adding ? "Tutup panel" : "Tambah media"}
        </Button>
      </header>

      {notice ? (
        <p
          role="status"
          className={cx(
            "border-l-4 px-3 py-2 text-sm",
            notice.tone === "ok"
              ? "border-[var(--board)] bg-[var(--board)]/5 text-[var(--ink)]"
              : "border-[var(--marker)] bg-red-50 text-red-900",
          )}
        >
          {notice.text}
        </p>
      ) : null}

      {/* ---------- Panel tambah ---------- */}
      {adding ? (
        <section className="border-2 border-[var(--ink)] bg-white">
          <div className="flex border-b border-[var(--chalk)]">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={cx(
                "flex items-center gap-2 px-4 py-2.5 text-sm",
                mode === "file"
                  ? "border-b-2 border-[var(--ink)] font-medium text-[var(--ink)]"
                  : "text-[var(--slate)] hover:text-[var(--ink)]",
              )}
            >
              <Icon name="upload" /> Dari komputer
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              className={cx(
                "flex items-center gap-2 px-4 py-2.5 text-sm",
                mode === "link"
                  ? "border-b-2 border-[var(--ink)] font-medium text-[var(--ink)]"
                  : "text-[var(--slate)] hover:text-[var(--ink)]",
              )}
            >
              <Icon name="link" /> Dari tautan
            </button>
          </div>

          {mode === "file" ? (
            <div className="space-y-3 p-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (e.dataTransfer.files) acceptFiles(e.dataTransfer.files);
                }}
                className={cx(
                  "border-2 border-dashed px-6 py-8 text-center",
                  dragging
                    ? "border-[var(--board)] bg-[var(--board)]/5"
                    : "border-[var(--chalk)]",
                )}
              >
                <p className="text-sm text-[var(--ink)]">
                  Seret gambar ke sini, atau
                </p>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => inputRef.current?.click()}
                  >
                    Pilih berkas
                  </Button>
                </div>
                <p className="mt-2 text-xs text-[var(--slate)]">
                  PNG, JPEG, atau WEBP · maksimal {MAX_MB} MB per berkas
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) acceptFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {localError ? (
                <p role="alert" className="text-sm text-[var(--marker)]">
                  {localError}
                </p>
              ) : null}

              {pendingFiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--ink)]">
                    Siap ditambahkan ({pendingFiles.length})
                  </p>
                  <ul className="divide-y divide-[var(--chalk)] border border-[var(--chalk)]">
                    {pendingFiles.map((f, i) => (
                      <PendingRow
                        key={`${f.name}-${i}`}
                        file={f}
                        onRemove={() => removePending(i)}
                        onUrl={(u) => objectUrls.current.push(u)}
                      />
                    ))}
                  </ul>
                  <Button onClick={commitPending} disabled={pending}>
                    {pending ? "Menambahkan…" : `Tambahkan ${pendingFiles.length} berkas`}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <label className="block text-xs">
                <span className="font-medium text-[var(--ink)]">
                  Alamat gambar
                </span>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    setLinkPreviewOk(null);
                  }}
                  placeholder="https://contoh.sch.id/gambar.jpg"
                  className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 font-mono text-sm"
                />
              </label>

              <label className="block text-xs">
                <span className="font-medium text-[var(--ink)]">
                  Nama berkas (opsional)
                </span>
                <input
                  type="text"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="Banner SPMB 2026"
                  className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
                />
              </label>

              {/* Pratinjau langsung: kalau gambar tidak muncul di sini, web
                  sekolah juga tidak akan bisa menampilkannya. */}
              {linkValid ? (
                <div className="border border-[var(--chalk)] bg-[var(--paper)] p-3">
                  {linkPreviewOk === false ? (
                    <p className="text-sm text-[var(--marker)]">
                      Gambar tidak bisa dimuat. Pastikan alamatnya langsung
                      menuju berkas gambar dan dapat diakses publik.
                    </p>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={linkUrl}
                        alt="Pratinjau tautan"
                        className="max-h-48 object-contain"
                        onLoad={() => setLinkPreviewOk(true)}
                        onError={() => setLinkPreviewOk(false)}
                      />
                      {linkPreviewOk ? (
                        <p className="mt-2 text-xs text-[var(--board)]">
                          Gambar berhasil dimuat.
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              <Button
                onClick={commitLink}
                disabled={!linkValid || linkPreviewOk === false || pending}
              >
                {pending ? "Menyimpan…" : "Tautkan gambar"}
              </Button>
            </div>
          )}
        </section>
      ) : null}

      {/* ---------- Bilah alat ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--slate)]">
            <Icon name="search" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama berkas atau alamat…"
            aria-label="Cari media"
            className="h-9 w-full border border-[var(--chalk)] bg-white pl-8 pr-3 text-sm"
          />
        </div>

        <div className="w-44">
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Saring media"
          >
            <option value="all">Semua berkas</option>
            <option value="used">Sudah dipakai</option>
            <option value="unused">Belum dipakai</option>
            <option value="upload">Hasil unggahan</option>
            <option value="link">Dari tautan</option>
            <option value="large">Ukuran &gt; 300 KB</option>
          </Select>
        </div>

        <div className="inline-flex border border-[var(--chalk)] bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label="Tampilan galeri"
            className={cx(
              "flex h-8 w-9 items-center justify-center",
              view === "grid"
                ? "bg-[var(--board)] text-white"
                : "text-[var(--slate)] hover:text-[var(--ink)]",
            )}
          >
            <Icon name="grid" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            aria-label="Tampilan daftar"
            className={cx(
              "flex h-8 w-9 items-center justify-center",
              view === "list"
                ? "bg-[var(--board)] text-white"
                : "text-[var(--slate)] hover:text-[var(--ink)]",
            )}
          >
            <Icon name="list" />
          </button>
        </div>
      </div>

      {/* ---------- Bilah hapus massal ---------- */}
      {checked.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-[var(--marker)] bg-white px-4 py-2.5">
          <span className="text-sm text-[var(--ink)]">
            {checked.size} berkas dipilih
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setChecked(new Set())}>
              Bersihkan pilihan
            </Button>
            <Button variant="danger" onClick={removeChecked} disabled={pending}>
              {pending ? "Menghapus…" : "Hapus terpilih"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---------- Isi ---------- */}
      <div
        className={cx(
          selected ? "grid gap-5 lg:grid-cols-[1fr_320px]" : "block",
        )}
      >
        <div className="min-w-0">
          {visible.length === 0 ? (
            <EmptyMedia
              hasItems={items.length > 0}
              onAdd={() => setAdding(true)}
              onClear={() => {
                setQuery("");
                setFilter("all");
              }}
            />
          ) : view === "grid" ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  checked={checked.has(item.id)}
                  onSelect={() =>
                    setSelectedId(selectedId === item.id ? null : item.id)
                  }
                  onCheck={() => toggleCheck(item.id)}
                />
              ))}
            </ul>
          ) : (
            <MediaList
              items={visible}
              selectedId={selectedId}
              checked={checked}
              onSelect={(id) => setSelectedId(selectedId === id ? null : id)}
              onCheck={toggleCheck}
            />
          )}
        </div>

        {selected ? (
          <DetailPanel
            item={selected}
            pending={pending}
            onClose={() => setSelectedId(null)}
            onDelete={() => removeOne(selected.id)}
            onSave={(fd) =>
              startTransition(async () => {
                const res = await updateMedia(fd);
                setNotice({
                  tone: res.ok ? "ok" : "warn",
                  text: noticeText(res),
                });
                router.refresh();
              })
            }
          />
        ) : null}
      </div>
    </div>
  );
}

/* ============================================================
 * BARIS BERKAS TUNGGU
 * ============================================================ */

function PendingRow({
  file,
  onRemove,
  onUrl,
}: {
  file: File;
  onRemove: () => void;
  onUrl: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    onUrl(u);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
    // `file` stabil selama baris ini hidup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="h-10 w-10 shrink-0 overflow-hidden border border-[var(--chalk)] bg-[var(--paper)]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[var(--ink)]">{file.name}</p>
        <p className="text-xs text-[var(--slate)]">{formatBytes(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Buang ${file.name}`}
        className="text-[var(--slate)] hover:text-[var(--marker)]"
      >
        <Icon name="close" />
      </button>
    </li>
  );
}

/* ============================================================
 * KARTU & BARIS
 * ============================================================ */

function MediaCard({
  item,
  selected,
  checked,
  onSelect,
  onCheck,
}: {
  item: MediaItem;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onCheck: () => void;
}) {
  return (
    <li
      className={cx(
        "group relative border-2 bg-white",
        selected ? "border-[var(--ink)]" : "border-[var(--chalk)]",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full text-left"
        aria-label={`Lihat ${item.name}`}
      >
        <div className="aspect-[4/3] overflow-hidden bg-[var(--paper)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.altText ?? item.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="border-t border-[var(--chalk)] px-3 py-2">
          <p className="truncate text-sm text-[var(--ink)]">{item.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--slate)]">
            <span>{formatBytes(item.bytes)}</span>
            {item.source === "LINK" ? <span>· tautan</span> : null}
            {item.usage.length === 0 ? (
              <span className="text-[var(--marker)]">· belum dipakai</span>
            ) : null}
          </p>
        </div>
      </button>

      {/* Kotak pilih muncul saat disorot, tetapi SELALU tampak bila sudah
          dicentang — kalau tersembunyi, operator lupa apa yang dipilih. */}
      <label
        className={cx(
          "absolute left-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center border-2 border-[var(--ink)] bg-white transition-opacity",
          checked ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          className="sr-only"
          aria-label={`Pilih ${item.name}`}
        />
        {checked ? (
          <span className="text-[var(--ink)]">
            <Icon name="check" className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </label>
    </li>
  );
}

function MediaList({
  items,
  selectedId,
  checked,
  onSelect,
  onCheck,
}: {
  items: MediaItem[];
  selectedId: string | null;
  checked: Set<string>;
  onSelect: (id: string) => void;
  onCheck: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden border-2 border-[var(--chalk)] bg-white">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-10" />
            <th className="w-14" />
            <th>Nama</th>
            <th className="w-24">Ukuran</th>
            <th className="w-28">Dimensi</th>
            <th className="w-28">Diunggah</th>
            <th className="w-52">Dipakai di</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={cx("cursor-pointer", selectedId === item.id && "bg-[var(--board)]/5")}
              onClick={() => onSelect(item.id)}
            >
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={checked.has(item.id)}
                  onChange={() => onCheck(item.id)}
                  aria-label={`Pilih ${item.name}`}
                />
              </td>
              <td>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  loading="lazy"
                  className="h-9 w-9 border border-[var(--chalk)] object-cover"
                />
              </td>
              <td className="text-[var(--ink)]">
                {item.name}
                {item.source === "LINK" ? (
                  <span className="ml-2 text-xs text-[var(--slate)]">tautan</span>
                ) : null}
              </td>
              <td className="tabular-nums text-[var(--slate)]">
                {formatBytes(item.bytes)}
              </td>
              <td className="tabular-nums text-xs text-[var(--slate)]">
                {item.width && item.height ? `${item.width}×${item.height}` : "—"}
              </td>
              <td className="tabular-nums text-xs text-[var(--slate)]">
                {item.uploadedAt}
              </td>
              <td className="text-xs text-[var(--slate)]">
                {item.usage.length > 0 ? item.usage.join(", ") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * PANEL DETAIL
 * ============================================================ */

function DetailPanel({
  item,
  pending,
  onClose,
  onDelete,
  onSave,
}: {
  item: MediaItem;
  pending: boolean;
  onClose: () => void;
  onDelete: () => void;
  onSave: (fd: FormData) => void;
}) {
  const [name, setName] = useState(item.name);
  const [altText, setAltText] = useState(item.altText ?? "");
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setName(item.name);
    setAltText(item.altText ?? "");
    setConfirming(false);
  }, [item]);

  const dirty = name !== item.name || altText !== (item.altText ?? "");

  function save() {
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("name", name);
    fd.set("altText", altText);
    onSave(fd);
  }

  return (
    <aside className="h-fit border-2 border-[var(--chalk)] bg-white">
      <header className="flex items-center justify-between border-b border-[var(--chalk)] px-3 py-2">
        <h2 className="font-display text-base text-[var(--ink)]">Detail berkas</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail"
          className="text-[var(--slate)] hover:text-[var(--ink)]"
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="border-b border-[var(--chalk)] bg-[var(--paper)] p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.altText ?? item.name}
          className="max-h-56 w-full object-contain"
        />
      </div>

      <dl className="divide-y divide-[var(--chalk)]">
        <Row label="Ukuran">{formatBytes(item.bytes)}</Row>
        <Row label="Dimensi">
          {item.width && item.height ? `${item.width} × ${item.height}` : "—"}
        </Row>
        <Row label="Sumber">
          {item.source === "UPLOAD" ? "Diunggah" : "Tautan luar"}
        </Row>
        <Row label="Diunggah">{item.uploadedAt}</Row>
        <Row label="Dipakai di">
          {item.usage.length > 0 ? (
            <ul className="space-y-0.5">
              {item.usage.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          ) : (
            <span className="text-[var(--marker)]">Belum dipakai</span>
          )}
        </Row>
      </dl>

      <div className="space-y-3 border-t border-[var(--chalk)] p-3">
        <label className="block text-xs">
          <span className="font-medium text-[var(--ink)]">Nama</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
          />
        </label>

        <label className="block text-xs">
          <span className="font-medium text-[var(--ink)]">
            Teks alternatif (untuk pembaca layar)
          </span>
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Deskripsi singkat gambar"
            className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
          />
        </label>

        {dirty ? (
          <Button onClick={save} disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan perubahan"}
          </Button>
        ) : null}

        <label className="block text-xs">
          <span className="font-medium text-[var(--ink)]">Alamat berkas</span>
          <div className="mt-1 flex gap-1">
            <input
              readOnly
              value={item.url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 border border-[var(--chalk)] bg-[var(--paper)] px-2 py-1.5 font-mono text-xs text-[var(--slate)]"
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(item.url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              aria-label="Salin alamat"
              className="border border-[var(--chalk)] px-2 text-[var(--slate)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
            >
              <Icon name={copied ? "check" : "copy"} />
            </button>
          </div>
        </label>

        {confirming ? (
          <div className="space-y-2 border-l-4 border-[var(--marker)] bg-red-50 px-3 py-2">
            <p className="text-sm text-red-900">
              Hapus <strong>{item.name}</strong> dari pustaka?
            </p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={onDelete} disabled={pending}>
                {pending ? "Menghapus…" : "Ya, hapus"}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            <Icon name="trash" /> Hapus berkas
          </Button>
        )}
      </div>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-3 py-2">
      <dt className="w-24 shrink-0 text-xs text-[var(--slate)]">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-[var(--ink)]">{children}</dd>
    </div>
  );
}

/* ============================================================
 * KEADAAN KOSONG
 * ============================================================ */

function EmptyMedia({
  hasItems,
  onAdd,
  onClear,
}: {
  hasItems: boolean;
  onAdd: () => void;
  onClear: () => void;
}) {
  return (
    <div className="border-2 border-dashed border-[var(--chalk)] bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center text-[var(--slate)]">
        <Icon name="image" className="h-8 w-8" />
      </div>
      {hasItems ? (
        <>
          <p className="mt-3 font-display text-lg text-[var(--ink)]">
            Tidak ada berkas yang cocok
          </p>
          <p className="mx-auto mt-1 max-w-prose text-sm text-[var(--slate)]">
            Ubah kata kunci atau saringan untuk melihat berkas lain.
          </p>
          <div className="mt-4">
            <Button variant="secondary" onClick={onClear}>
              Bersihkan saringan
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 font-display text-lg text-[var(--ink)]">
            Pustaka masih kosong
          </p>
          <p className="mx-auto mt-1 max-w-prose text-sm text-[var(--slate)]">
            Tambahkan gambar untuk dipakai di berita, halaman, atau halaman
            depan web sekolah. Bisa dari komputer maupun dari tautan.
          </p>
          <div className="mt-4">
            <Button onClick={onAdd}>Tambah media</Button>
          </div>
        </>
      )}
    </div>
  );
}
