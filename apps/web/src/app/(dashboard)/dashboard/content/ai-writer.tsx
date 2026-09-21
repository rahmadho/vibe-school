"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Textarea } from "@/components/form-fields";
import { generateArticleDraft } from "./ai-actions";

/**
 * Panel "Tulis dengan AI" di halaman tulis berita.
 *
 * ============================================================
 * KENAPA ARAHAN DULU, BARU TOMBOL
 * ============================================================
 * Model bahasa yang diberi arahan kosong akan mengarang isi — dan berita
 * karangan di website sekolah dibaca orang tua sebagai fakta. Karena itu
 * tombolnya nonaktif sampai operator menuliskan bahan mentahnya lebih dulu
 * (minimal 10 karakter), dan panel ini menjelaskan APA yang sebaiknya ditulis
 * di situ.
 *
 * ============================================================
 * KENAPA HASILNYA MASUK KE FORM, BUKAN LANGSUNG TERSIMPAN
 * ============================================================
 * Draf AI selalu perlu dibaca manusia. Panel ini mengisi judul, ringkasan, dan
 * isi di form — operator tetap harus memeriksa dan menekan "Simpan". Tidak ada
 * jalur yang membuat tulisan AI tayang tanpa dilihat seseorang.
 */
export function AiWriter({
  kind,
  currentTitle,
  onApply,
}: {
  /** Jenis konten saat ini (NEWS/ANNOUNCEMENT/AGENDA/GALLERY). */
  kind: string;
  /** Judul yang sudah diketik operator, dipakai sebagai petunjuk tambahan. */
  currentTitle: string;
  onApply: (result: { title: string; excerpt: string; content: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const canGenerate = brief.trim().length >= 10 && !pending;

  async function run() {
    setPending(true);
    setError(null);
    setApplied(false);

    const fd = new FormData();
    fd.set("brief", brief);
    fd.set("title", currentTitle);
    fd.set("kind", kind);

    const res = await generateArticleDraft(fd);
    setPending(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    onApply({ title: res.title, excerpt: res.excerpt, content: res.content });
    setApplied(true);
  }

  if (!open) {
    return (
      <div className="border-2 border-dashed border-[var(--chalk)] bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">
              Bantu tulis dengan AI
            </p>
            <p className="mt-0.5 text-xs text-[var(--slate)]">
              Susun draf dari catatan singkat, lalu periksa dan sunting sendiri.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            Buka bantuan AI
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-[var(--ink)] bg-white">
      <header className="flex items-center justify-between border-b border-[var(--chalk)] px-4 py-2.5">
        <h3 className="font-display text-base text-[var(--ink)]">Bantu tulis dengan AI</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--slate)] hover:text-[var(--ink)]"
        >
          Tutup
        </button>
      </header>

      <div className="space-y-3 p-4">
        <label className="block text-xs">
          <span className="font-medium text-[var(--ink)]">
            Catatan bahan (yang AI tidak boleh mengarang)
          </span>
          <span className="mt-0.5 block text-[11px] text-[var(--slate)]">
            Tulis fakta yang Anda punya: apa kegiatannya, kapan, di mana, siapa
            yang terlibat. AI hanya menyusun kalimatnya — bukan menambah fakta.
          </span>
          <Textarea
            value={brief}
            onChange={(e) => {
              setBrief(e.target.value);
              setApplied(false);
            }}
            rows={5}
            placeholder="Contoh: Upacara peringatan HUT RI ke-80, Senin 17 Agustus 2026 pukul 07.00 di lapangan sekolah. Diikuti seluruh siswa kelas 7-9 dan bapak ibu guru. Pembina upacara Kepala Sekolah. Ada penampilan paduan suara."
            className="mt-1.5"
          />
        </label>

        <p className="text-[11px] text-[var(--slate)]">
          {brief.trim().length}/10 karakter minimum
        </p>

        {error ? (
          <p role="alert" className="border-l-4 border-[var(--marker)] bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </p>
        ) : null}

        {applied ? (
          <p
            role="status"
            className="border-l-4 border-[var(--board)] bg-[var(--board)]/5 px-3 py-2 text-sm text-[var(--ink)]"
          >
            Draf dimasukkan ke form. <strong>Periksa dan sunting dulu</strong>{" "}
            sebelum menyimpan.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={run} disabled={!canGenerate}>
            {pending ? "Menyusun draf…" : "Susun draf"}
          </Button>
          {pending ? (
            <span className="self-center text-xs text-[var(--slate)]">
              Bisa sampai satu menit.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
