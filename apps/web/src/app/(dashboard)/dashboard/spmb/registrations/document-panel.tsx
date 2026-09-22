"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import {
  uploadRegistrationDocument,
  deleteRegistrationDocument,
} from "../admission-actions";
import {
  REGISTRATION_DOC_KINDS,
  REGISTRATION_DOC_LABEL,
  type RegistrationDocKind,
} from "@/lib/validations/spmb-docs";

/**
 * Panel dokumen pendaftaran.
 *
 * ============================================================
 * KENAPA SATU BARIS PER DOKUMEN, BUKAN SATU TOMBOL UNGGAH
 * ============================================================
 * Sekolah meminta empat dokumen berbeda (akta, KK, pas foto, ijazah), dan
 * panitia perlu tahu MANA yang sudah masuk dan mana yang belum. Satu tombol
 * unggah serbaguna tidak bisa menjawab pertanyaan itu — operator harus membuka
 * satu per satu untuk memeriksa.
 *
 * Di sini setiap dokumen punya barisnya sendiri dengan keadaan yang terlihat
 * sekilas: sudah ada (dengan tautan) atau belum.
 *
 * ============================================================
 * KENAPA BERKAS DIUNGGAH SATU PER SATU
 * ============================================================
 * Berkas hasil pindai bisa besar. Mengirim empat sekaligus berarti satu
 * kegagalan menggagalkan semuanya, dan panitia harus mengulang dari awal.
 */
export function DocumentPanel({
  registrationId,
  docs,
  canManage,
}: {
  registrationId: string;
  docs: {
    docBirthCert: string | null;
    docFamilyCard: string | null;
    docPhoto: string | null;
    docDiploma: string | null;
  };
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKind, setBusyKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function upload(kind: RegistrationDocKind, file: File) {
    setError(null);
    setBusyKind(kind);

    const fd = new FormData();
    fd.set("registrationId", registrationId);
    fd.set("kind", kind);
    fd.set("file", file);

    startTransition(async () => {
      const r = await uploadRegistrationDocument(fd);
      setBusyKind(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function remove(kind: RegistrationDocKind) {
    setError(null);
    setBusyKind(kind);
    startTransition(async () => {
      const r = await deleteRegistrationDocument(registrationId, kind);
      setBusyKind(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  const uploaded = REGISTRATION_DOC_KINDS.filter((k) => docs[k]).length;

  return (
    <div className="border-2 border-[var(--chalk)] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base text-[var(--ink)]">Dokumen</h3>
        <span className="text-xs tabular-nums text-[var(--slate)]">
          {uploaded}/{REGISTRATION_DOC_KINDS.length} terkumpul
        </span>
      </div>

      {error ? (
        <p role="alert" className="mt-2 border-l-4 border-[var(--marker)] bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 divide-y divide-[var(--chalk)] border border-[var(--chalk)]">
        {REGISTRATION_DOC_KINDS.map((kind) => {
          const url = docs[kind];
          const busy = busyKind === kind && pending;

          return (
            <li key={kind} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 text-sm text-[var(--ink)]">
                {REGISTRATION_DOC_LABEL[kind]}
              </span>

              {url ? (
                <>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--board)] underline"
                  >
                    Lihat berkas
                  </a>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => remove(kind)}
                      disabled={busy}
                      className="text-xs text-[var(--slate)] hover:text-[var(--marker)] disabled:opacity-50"
                    >
                      {busy ? "Menghapus…" : "Hapus"}
                    </button>
                  ) : null}
                </>
              ) : (
                <span className="text-xs text-[var(--slate)]">belum ada</span>
              )}

              {canManage ? (
                <label className="cursor-pointer border border-[var(--chalk)] px-2 py-1 text-xs text-[var(--ink)] hover:border-[var(--ink)]">
                  {busy ? "Mengunggah…" : url ? "Ganti" : "Unggah"}
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) upload(kind, file);
                      // Nilai input dikosongkan agar berkas yang sama bisa
                      // diunggah ulang setelah dihapus — tanpa ini peramban
                      // menganggap tidak ada perubahan dan tidak memicu apa pun.
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[11px] text-[var(--slate)]">
        PDF atau gambar, maksimal 5 MB per berkas.
      </p>
    </div>
  );
}
