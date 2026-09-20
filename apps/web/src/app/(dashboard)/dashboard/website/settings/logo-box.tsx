"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeSchoolLogo,
  uploadSchoolLogo,
} from "@/app/(dashboard)/dashboard/website/actions";
import type { ActionResult } from "@/lib/action-result";

/**
 * Pengelola logo sekolah.
 *
 * Logo adalah hal pertama yang dilihat pengunjung, jadi umpan baliknya harus
 * langsung: pratinjau diperbarui dari berkas yang baru diunggah, tanpa menunggu
 * server.
 *
 * Peringatan ukuran ditulis di UI, bukan hanya divalidasi server — operator yang
 * memilih foto 6 MB dari ponsel perlu tahu SEBELUM menekan simpan, bukan setelah
 * ditolak.
 */

const MAX_MB = 2;
const ACCEPTED = "image/png,image/jpeg,image/webp";

export function LogoBox({
  currentUrl,
  schoolName,
}: {
  currentUrl: string;
  schoolName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  // Pratinjau lokal dari berkas yang baru dipilih.
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const shown = preview ?? (currentUrl || null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setResult(null);
    setLocalError(null);

    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      return;
    }

    // Pemeriksaan awal di browser: hemat waktu operator. Server tetap
    // memeriksa ulang isi berkas — ini hanya kenyamanan, bukan pengamanan.
    if (file.size > MAX_MB * 1024 * 1024) {
      setLocalError(`Ukuran berkas ${(file.size / 1024 / 1024).toFixed(1)} MB, maksimal ${MAX_MB} MB.`);
      setPreview(null);
      return;
    }
    if (!ACCEPTED.split(",").includes(file.type)) {
      setLocalError("Format harus PNG, JPEG, atau WEBP.");
      setPreview(null);
      return;
    }

    setPreview(URL.createObjectURL(file));
  }

  function submit() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setLocalError("Pilih berkas gambar terlebih dahulu.");
      return;
    }

    const fd = new FormData();
    fd.set("logo", file);

    startTransition(async () => {
      const r = await uploadSchoolLogo(fd);
      setResult(r);
      if (r.ok) {
        setPreview(null);
        setLocalError(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const r = await removeSchoolLogo();
      setResult(r);
      if (r.ok) {
        setPreview(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    });
  }

  const error = localError ?? (result && !result.ok ? result.error : null);

  return (
    <section className="border-2 border-[var(--chalk)] bg-white p-4">
      <h3 className="text-sm font-semibold text-[var(--ink)]">Logo sekolah</h3>
      <p className="mt-0.5 text-xs text-[var(--slate)]">
        Tampil di header dan footer web sekolah. Gunakan gambar persegi dengan
        latar transparan (PNG) bila ada. Maksimal {MAX_MB} MB.
      </p>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        {/* Pratinjau */}
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center border-2 border-dashed border-[var(--chalk)] bg-[var(--paper)]"
          aria-live="polite"
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt={`Logo ${schoolName}`}
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="text-center text-[11px] text-[var(--slate)]">
              Belum ada logo
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            onChange={onPick}
            aria-label="Berkas logo"
            className="block w-full text-xs text-[var(--ink)] file:mr-2 file:border-2 file:border-[var(--chalk)] file:bg-white file:px-3 file:py-1.5 file:text-xs"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="border-2 border-[var(--ink)] bg-[var(--marker)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
            >
              {pending ? "Menyimpan…" : "Simpan logo"}
            </button>

            {currentUrl && !preview && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="text-xs text-red-800 underline disabled:opacity-50"
              >
                Hapus logo
              </button>
            )}
          </div>

          {error && (
            <p className="border-l-4 border-red-700 bg-red-50 px-3 py-2 text-xs text-red-900">
              {error}
            </p>
          )}
          {result?.ok && (
            <p className="text-xs text-emerald-800">{result.message ?? "Tersimpan."}</p>
          )}
        </div>
      </div>
    </section>
  );
}
