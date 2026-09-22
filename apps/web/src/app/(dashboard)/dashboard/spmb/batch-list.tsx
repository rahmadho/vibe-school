"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { formatRupiah } from "@/lib/format";
import {
  createAdmissionBatch,
  createAdmissionPath,
  deleteAdmissionPath,
  saveAdmissionResult,
  updateAdmissionBatch,
  updateAdmissionPath,
} from "@/app/(dashboard)/dashboard/spmb/admission-actions";

/**
 * Daftar gelombang + pengelolaan JALUR pendaftaran.
 *
 * KENAPA JALUR DIKELOLA DI SINI, BUKAN DI HALAMAN TERPISAH:
 * Panitia memikirkan "gelombang ini jalurnya apa saja" dalam satu tarikan napas.
 * Memisahkannya ke dua halaman membuat mereka harus bolak-balik hanya untuk
 * menambah satu jalur.
 */

type PathRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  registrationFee: number | null;
  quota: number | null;
  requirements: string | null;
  order: number;
  isActive: boolean;
  filled: number;
};

type BatchRow = {
  id: string;
  name: string;
  academicYearId: string;
  openDate: string;
  closeDate: string;
  resultDate: string | null;
  resultAnnouncement: string | null;
  description: string | null;
  requirements: string | null;
  quota: number;
  isActive: boolean;
  registrationCount: number;
  paths: PathRow[];
};

export function BatchList({
  batches,
  academicYears,
  canManage,
}: {
  batches: BatchRow[];
  academicYears: { id: string; name: string; isActive: boolean }[];
  canManage: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  /** Gelombang yang panel pengumuman hasilnya sedang terbuka. */
  const [resultOpen, setResultOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(action: (fd: FormData) => Promise<ActionResult>, fd: FormData, onOk?: () => void) {
    startTransition(async () => {
      const r = await action(fd);
      setResult(r);
      if (r.ok) onOk?.();
    });
  }

  console.log(batches)

  return (
    <div className="space-y-4">
      {result && !result.ok && (
        <p className="border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
          {result.error}
        </p>
      )}
      {result?.ok && result.message && (
        <p className="border-l-4 border-emerald-700 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {result.message}
        </p>
      )}

      {canManage && (
        <div className="border-2 border-[var(--chalk)] bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[var(--ink)]">
              Gelombang pendaftaran
            </h2>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 text-sm hover:border-[var(--ink)]"
            >
              {adding ? "Batal" : "Buat gelombang"}
            </button>
          </div>

          {adding && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(createAdmissionBatch, new FormData(e.currentTarget), () => setAdding(false));
              }}
              className="mt-3 grid gap-3 border-t border-dashed border-[var(--chalk)] pt-3 sm:grid-cols-2"
            >
              <Field label="Nama gelombang" name="name" required placeholder="SPMB 2026/2027 Gelombang 1" />
              <label className="block text-xs">
                <span className="font-medium text-[var(--ink)]">Tahun ajaran</span>
                <select
                  name="academicYearId"
                  required
                  className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">— pilih —</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                      {y.isActive ? " (aktif)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Dibuka" name="openDate" type="date" required />
              <Field label="Ditutup" name="closeDate" type="date" required />
              <Field label="Pengumuman hasil" name="resultDate" type="date" />
              <Field label="Kuota total" name="quota" type="number" required placeholder="120" />
              <label className="block text-xs sm:col-span-2">
                <span className="font-medium text-[var(--ink)]">Keterangan</span>
                <textarea
                  name="description"
                  rows={2}
                  className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
                  placeholder="Informasi umum yang tampil di halaman pendaftaran publik."
                />
              </label>

              {/* Kotak centang ini WAJIB ada. Tanpa ini `isActive` tidak pernah
                  terkirim, dan sebelum skema diperbaiki itu membuat setiap
                  gelombang baru lahir nonaktif — pendaftaran tidak pernah
                  terbuka walau tanggalnya sudah benar. */}
              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                <input type="checkbox" name="isActive" defaultChecked />
                <span className="text-[var(--ink)]">
                  Aktifkan sekarang (pendaftaran dibuka)
                </span>
              </label>

              <p className="text-[11px] text-[var(--slate)] sm:col-span-2">
                Satu jalur bernama <strong>Reguler</strong> dibuat otomatis. Tambahkan jalur
                lain setelah gelombang tersimpan.
              </p>
              <button
                type="submit"
                disabled={pending}
                className="border-2 border-[var(--ink)] bg-[var(--marker)] px-4 py-2 text-sm font-semibold disabled:opacity-50 sm:col-span-2"
              >
                {pending ? "Menyimpan…" : "Simpan gelombang"}
              </button>
            </form>
          )}
        </div>
      )}

      {batches.length === 0 && (
        <div className="border-2 border-dashed border-[var(--chalk)] px-4 py-8 text-center">
          <p className="font-medium text-[var(--ink)]">Belum ada gelombang pendaftaran</p>
          <p className="mt-1 text-sm text-[var(--slate)]">
            Buat gelombang pertama untuk mulai menerima pendaftar.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {batches.map((b) => {
          const isOpen = openId === b.id;
          const totalQuota = b.paths.reduce((s, p) => s + (p.quota ?? 0), 0);
          const totalFilled = b.paths.reduce((s, p) => s + p.filled, 0);

          return (
            <li key={b.id} className="border-2 border-[var(--chalk)] bg-white">
              <div className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-[var(--ink)]">
                      {b.name}
                    </h3>
                    {!b.isActive && (
                      <span className="border border-[var(--chalk)] px-1.5 py-0.5 text-[11px] text-[var(--slate)]">
                        nonaktif
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--slate)]">
                    {fmtDate(b.openDate)} – {fmtDate(b.closeDate)}
                    {b.resultDate ? ` · pengumuman ${fmtDate(b.resultDate)}` : ""}
                  </p>
                  <p className="mt-1.5 text-sm text-[var(--ink)]">
                    <span className="font-mono">{b.registrationCount}</span> pendaftar
                    {totalQuota > 0 && (
                      <span className="text-[var(--slate)]">
                        {" "}
                        · kuota jalur {totalFilled}/{totalQuota}
                      </span>
                    )}
                    {totalQuota === 0 && (
                      <span className="text-[var(--slate)]"> · kuota gelombang {b.quota}</span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOpenId(isOpen ? null : b.id);
                    setResultOpen(null);
                  }}
                  className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 text-sm hover:border-[var(--ink)]"
                >
                  {isOpen ? "Tutup" : `Jalur (${b.paths.length})`}
                </button>

                {/* Pengumuman hasil seleksi. Tanpa tombol ini, kolom
                    `resultAnnouncement` tidak punya cara diisi sama sekali —
                    padahal halaman Cek Status publik sudah membacanya, dan
                    orang tua tidak pernah melihat pengumuman apa pun. */}
                <button
                  type="button"
                  onClick={() => {
                    setResultOpen(resultOpen === b.id ? null : b.id);
                    setOpenId(null);
                  }}
                  className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 text-sm hover:border-[var(--ink)]"
                >
                  {resultOpen === b.id
                    ? "Tutup"
                    : b.resultAnnouncement
                      ? "Pengumuman ✓"
                      : "Pengumuman"}
                </button>
              </div>

              {resultOpen === b.id ? (
                <div className="border-t border-dashed border-[var(--chalk)] bg-[var(--paper)] p-4">
                  <h4 className="text-sm font-semibold text-[var(--ink)]">
                    Pengumuman hasil seleksi
                  </h4>
                  <p className="mt-1 text-[11px] text-[var(--slate)]">
                    Tampil di halaman Cek Status publik. Isi kapan dan bagaimana
                    hasil diumumkan — berbeda dari catatan per pendaftar.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit(saveAdmissionResult, new FormData(e.currentTarget));
                    }}
                    className="mt-3 space-y-3"
                  >
                    <input type="hidden" name="batchId" value={b.id} />

                    <label className="block text-xs">
                      <span className="font-medium text-[var(--ink)]">
                        Isi pengumuman
                      </span>
                      <textarea
                        name="resultAnnouncement"
                        rows={4}
                        defaultValue={b.resultAnnouncement ?? ""}
                        placeholder="Contoh: Hasil seleksi diumumkan 1 Juli 2026. Daftar ulang 1–10 Juli 2026 dengan membawa fotokopi akta kelahiran dan kartu keluarga."
                        className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs">
                        <span className="font-medium text-[var(--ink)]">
                          Tanggal pengumuman
                        </span>
                        <input
                          type="date"
                          name="resultDate"
                          defaultValue={b.resultDate ?? ""}
                          className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
                        />
                      </label>

                      <label className="flex items-start gap-2 self-end text-xs">
                        <input
                          type="checkbox"
                          name="notify"
                          className="mt-0.5 h-4 w-4 accent-[var(--board)]"
                        />
                        <span>
                          <span className="block font-medium text-[var(--ink)]">
                            Kirim WA ke pendaftar yang sudah diputus
                          </span>
                          <span className="mt-0.5 block text-[11px] text-[var(--slate)]">
                            Hanya yang berstatus diterima, ditolak, atau
                            cadangan.
                          </span>
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={pending}
                      className="border-2 border-[var(--ink)] bg-[var(--marker)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {pending ? "Menyimpan…" : "Simpan pengumuman"}
                    </button>
                  </form>
                </div>
              ) : null}

              {isOpen && (
                <div className="border-t border-dashed border-[var(--chalk)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--ink)]">Jalur pendaftaran</h4>
                    <p className="text-[11px] text-[var(--slate)]">
                      Total kuota semua jalur tidak boleh melebihi kuota gelombang ({b.quota}).
                    </p>
                  </div>

                  <ul className="mt-2 divide-y divide-[var(--chalk)] border border-[var(--chalk)]">
                    {b.paths.map((p) => (
                      <li key={p.id} className="p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-[var(--ink)]">{p.name}</span>
                              <span className="border border-[var(--chalk)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--slate)]">
                                {p.code}
                              </span>
                              {!p.isActive && (
                                <span className="text-[11px] text-[var(--slate)]">nonaktif</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-[var(--slate)]">
                              Biaya: {p.registrationFee ? formatRupiah(p.registrationFee) : "Gratis"}
                              {p.quota !== null && ` · kuota ${p.filled}/${p.quota}`}
                              {p.quota !== null && p.filled >= p.quota && (
                                <span className="ml-1 font-medium text-red-800">penuh</span>
                              )}
                            </p>
                            {p.description && (
                              <p className="mt-1 text-xs text-[var(--slate)]">{p.description}</p>
                            )}
                          </div>

                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                const fd = new FormData();
                                fd.set("id", p.id);
                                submit(deleteAdmissionPath, fd);
                              }}
                              disabled={pending}
                              className="text-xs text-red-800 underline disabled:opacity-50"
                            >
                              Hapus
                            </button>
                          )}
                        </div>

                        {canManage && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-[var(--slate)]">
                              Ubah jalur ini
                            </summary>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                submit(updateAdmissionPath, new FormData(e.currentTarget));
                              }}
                              className="mt-2 grid gap-2 sm:grid-cols-2"
                            >
                              <input type="hidden" name="id" value={p.id} />
                              <SmallField label="Nama" name="name" defaultValue={p.name} />
                              <SmallField label="Kode" name="code" defaultValue={p.code} />
                              <SmallField
                                label="Biaya (Rp)"
                                name="registrationFee"
                                type="number"
                                defaultValue={String(p.registrationFee ?? 0)}
                              />
                              <SmallField
                                label="Kuota"
                                name="quota"
                                type="number"
                                defaultValue={p.quota === null ? "" : String(p.quota)}
                              />
                              <label className="block text-xs sm:col-span-2">
                                <span className="font-medium text-[var(--ink)]">Keterangan</span>
                                <input
                                  name="description"
                                  defaultValue={p.description ?? ""}
                                  className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
                                />
                              </label>
                              <label className="flex items-center gap-2 text-xs">
                                <input type="checkbox" name="isActive" defaultChecked={p.isActive} />
                                <span>Aktif (tampil di halaman pendaftaran)</span>
                              </label>
                              <button
                                type="submit"
                                disabled={pending}
                                className="border-2 border-[var(--ink)] bg-[var(--marker)] px-3 py-1.5 text-sm font-semibold disabled:opacity-50 sm:col-span-2"
                              >
                                Simpan perubahan
                              </button>
                            </form>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>

                  {canManage && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-[var(--ink)] underline">
                        Tambah jalur pendaftaran
                      </summary>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          submit(createAdmissionPath, new FormData(e.currentTarget));
                        }}
                        className="mt-2 grid gap-2 border-t border-dashed border-[var(--chalk)] pt-3 sm:grid-cols-2"
                      >
                        <input type="hidden" name="batchId" value={b.id} />
                        <SmallField label="Nama jalur" name="name" required placeholder="Prestasi" />
                        <SmallField label="Kode" name="code" required placeholder="PRESTASI" />
                        <SmallField label="Biaya (Rp)" name="registrationFee" type="number" defaultValue="0" />
                        <SmallField label="Kuota" name="quota" type="number" placeholder="30" />
                        <label className="block text-xs sm:col-span-2">
                          <span className="font-medium text-[var(--ink)]">
                            Syarat khusus jalur ini
                          </span>
                          <textarea
                            name="requirements"
                            rows={2}
                            className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
                            placeholder="Contoh: melampirkan sertifikat juara tingkat kabupaten."
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={pending}
                          className="border-2 border-[var(--ink)] bg-[var(--marker)] px-3 py-1.5 text-sm font-semibold disabled:opacity-50 sm:col-span-2"
                        >
                          Tambah jalur
                        </button>
                      </form>
                    </details>
                  )}

                  {canManage && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-[var(--slate)]">
                        Ubah gelombang ini
                      </summary>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          submit(updateAdmissionBatch, new FormData(e.currentTarget));
                        }}
                        className="mt-2 grid gap-2 border-t border-dashed border-[var(--chalk)] pt-3 sm:grid-cols-2"
                      >
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="academicYearId" value={b.academicYearId} />
                        <SmallField label="Nama" name="name" defaultValue={b.name} />
                        <SmallField label="Kuota" name="quota" type="number" defaultValue={String(b.quota)} />
                        {/* Tanggal ikut ditampilkan: skema kini menerima
                            suntingan sebagian, tetapi operator tetap perlu
                            bisa memperpanjang atau memajukan periode tanpa
                            membongkar gelombangnya. */}
                        <SmallField
                          label="Dibuka"
                          name="openDate"
                          type="date"
                          defaultValue={toDateInput(b.openDate)}
                        />
                        <SmallField
                          label="Ditutup"
                          name="closeDate"
                          type="date"
                          defaultValue={toDateInput(b.closeDate)}
                        />
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" name="isActive" defaultChecked={b.isActive} />
                          <span>Aktif (pendaftaran dibuka)</span>
                        </label>
                        <button
                          type="submit"
                          disabled={pending}
                          className="border-2 border-[var(--ink)] bg-[var(--marker)] px-3 py-1.5 text-sm font-semibold disabled:opacity-50 sm:col-span-2"
                        >
                          Simpan gelombang
                        </button>
                      </form>
                    </details>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- komponen kecil ---------- */

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function SmallField({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Ubah tanggal ISO menjadi nilai untuk `<input type="date">` (YYYY-MM-DD).
 *
 * Tidak bisa memakai `toISOString().slice(0,10)` langsung: tanggal disimpan
 * sebagai tengah malam UTC, dan di zona waktu Indonesia (UTC+7) itu masih
 * tanggal yang sama — tetapi di zona barat (UTC-5) akan tergeser sehari ke
 * belakang. Karena itu komponen tanggal LOKAL yang diambil.
 */
function toDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
