"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import {
  reviewRegistration,
  convertRegistrationToStudent,
} from "@/app/(dashboard)/dashboard/spmb/admission-actions";

/**
 * Tabel pendaftar + tindakan seleksi.
 *
 * Keputusan diterima/ditolak dilakukan dari sini karena panitia biasanya
 * memutuskan sambil menyisir daftar. Nominal daftar ulang diminta bersamaan
 * dengan keputusan "diterima" — supaya operator tidak perlu mengingat untuk
 * mengisinya belakangan.
 */

const STATUSES = [
  { value: "PENDING", label: "Menunggu verifikasi" },
  { value: "VERIFIED", label: "Dokumen lengkap" },
  { value: "TESTED", label: "Sudah seleksi" },
  { value: "ACCEPTED", label: "Diterima" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "WAITLIST", label: "Cadangan" },
  { value: "WITHDRAWN", label: "Mengundurkan diri" },
];

type Row = {
  id: string;
  registrationNo: string;
  fullName: string;
  gender: string;
  parentName: string;
  parentPhone: string;
  status: string;
  statusLabel: string;
  batchName: string;
  pathName: string | null;
  majorName: string | null;
  /** Sudah pernah dikonversi menjadi siswa? Menandai penanda idempotensi. */
  isConverted: boolean;
  resultNote: string | null;
  submittedAt: string;
};

export function RegistrationTable({
  rows,
  canManage,
  classes,
  majors,
}: {
  rows: Row[];
  canManage: boolean;
  classes: Array<{ id: string; name: string }>;
  majors: Array<{ id: string; name: string }>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function review(fd: FormData) {
    startTransition(async () => {
      const r = await reviewRegistration(fd);
      setResult(r);
      if (r.ok) setOpenId(null);
    });
  }

  function convert(fd: FormData) {
    startTransition(async () => {
      const r = await convertRegistrationToStudent(fd);
      setResult(r);
      if (r.ok) setOpenId(null);
    });
  }

  const activeRow = openId ? (rows.find((r) => r.id === openId) ?? null) : null;

  if (rows.length === 0) {
    return (
      <div className="border-2 border-dashed border-[var(--chalk)] px-4 py-10 text-center">
        <p className="font-medium text-[var(--ink)]">Belum ada pendaftar</p>
        <p className="mt-1 text-sm text-[var(--slate)]">
          Pendaftar yang masuk lewat web sekolah akan muncul di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

      {/* Tabel seperti buku induk: garis tegas, bukan kartu melayang. */}
      <div className="overflow-x-auto border-2 border-[var(--chalk)] bg-white">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--ink)] text-left">
              <th className="p-2 font-semibold text-[var(--ink)]">No. Pendaftaran</th>
              <th className="p-2 font-semibold text-[var(--ink)]">Nama</th>
              <th className="p-2 font-semibold text-[var(--ink)]">Jalur</th>
              <th className="p-2 font-semibold text-[var(--ink)]">Ortu / Wali</th>
              <th className="p-2 font-semibold text-[var(--ink)]">Status</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--chalk)] align-top">
                <td className="p-2 font-mono text-xs text-[var(--slate)]">
                  {r.registrationNo}
                </td>
                <td className="p-2">
                  <span className="font-medium text-[var(--ink)]">{r.fullName}</span>
                  <span className="block text-xs text-[var(--slate)]">
                    {r.gender === "MALE" ? "Laki-laki" : "Perempuan"} · {r.batchName}
                  </span>
                </td>
                <td className="p-2 text-[var(--ink)]">
                  {r.pathName ?? <span className="text-[var(--slate)]">—</span>}
                </td>
                <td className="p-2 text-[var(--ink)]">
                  {r.parentName}
                  <span className="block font-mono text-xs text-[var(--slate)]">
                    {r.parentPhone}
                  </span>
                </td>
                <td className="p-2">
                  <StatusPill status={r.status} label={r.statusLabel} />
                </td>
                <td className="p-2 text-right">
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === r.id ? null : r.id)}
                      className="border border-[var(--chalk)] px-2 py-1 text-xs hover:border-[var(--ink)]"
                    >
                      {openId === r.id ? "Tutup" : "Tinjau"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Panel tinjauan — di luar tabel agar tidak menyempitkan kolom. */}
      {openId && canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            review(new FormData(e.currentTarget));
          }}
          className="border-2 border-[var(--ink)] bg-white p-4"
        >
          <input type="hidden" name="id" value={openId} />
          <h3 className="font-display text-base font-semibold text-[var(--ink)]">
            Tinjau pendaftaran
          </h3>
          <p className="mt-0.5 text-xs text-[var(--slate)]">
            Bila diterima, panitia dapat mengisi biaya daftar ulang. Tagihan dibuat
            setelah pendaftar dibuatkan akun siswa (di menu Siswa), bukan di sini.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="font-medium text-[var(--ink)]">Status</span>
              <select
                name="status"
                defaultValue={rows.find((r) => r.id === openId)?.status ?? "PENDING"}
                className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="font-medium text-[var(--ink)]">
                Biaya daftar ulang (Rp) — opsional
              </span>
              <input
                type="number"
                name="reRegistrationFee"
                defaultValue="0"
                className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
              />
            </label>

            <label className="block text-xs sm:col-span-2">
              <span className="font-medium text-[var(--ink)]">Catatan untuk pendaftar</span>
              <textarea
                name="note"
                rows={2}
                defaultValue={rows.find((r) => r.id === openId)?.resultNote ?? ""}
                className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
                placeholder="Contoh: harap bawa fotokopi akta saat daftar ulang."
              />
            </label>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="border-2 border-[var(--ink)] bg-[var(--marker)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "Menyimpan…" : "Simpan keputusan"}
            </button>
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="border-2 border-[var(--chalk)] bg-white px-3 py-2 text-sm"
            >
              Batal
            </button>
          </div>

          <p className="mt-2 text-[11px] text-[var(--slate)]">
            Bila status diubah menjadi Diterima atau Ditolak, pesan WhatsApp ke nomor wali
            masuk antrean dan dikirim otomatis sesuai jam wajar.
          </p>
        </form>
      )}

      {/* Konversi ke siswa — hanya untuk pendaftar yang sudah DITERIMA.
          Dipisah dari form keputusan karena ini tindakan berbeda: menilai
          pendaftaran vs. memasukkan anak ke data induk sekolah. */}
      {openId && canManage && activeRow?.status === "ACCEPTED" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            convert(new FormData(e.currentTarget));
          }}
          className="border-2 border-[var(--board)] bg-white p-4"
        >
          <input type="hidden" name="registrationId" value={openId} />
          <h3 className="font-display text-base font-semibold text-[var(--ink)]">
            Jadikan siswa
          </h3>

          {activeRow.isConverted ? (
            <p className="mt-2 border-l-4 border-[var(--board)] bg-[var(--board)]/5 px-3 py-2 text-sm text-[var(--ink)]">
              Pendaftar ini sudah terdaftar sebagai siswa.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-[var(--slate)]">
                Data pendaftar disalin otomatis (nama, jenis kelamin, tempat/tanggal
                lahir, agama, alamat, wali
                {activeRow.majorName ? `, jurusan ${activeRow.majorName}` : ""}).
                Isi hanya yang belum ada.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="font-medium text-[var(--ink)]">NIS</span>
                  <input
                    name="nis"
                    required
                    className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 font-mono text-sm"
                    placeholder="Nomor induk siswa"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-medium text-[var(--ink)]">
                    Tahun masuk
                  </span>
                  <input
                    name="entryYear"
                    type="number"
                    defaultValue={new Date().getFullYear()}
                    className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 tabular-nums text-sm"
                  />
                </label>

                <label className="block text-xs sm:col-span-2">
                  <span className="font-medium text-[var(--ink)]">
                    Kelas (opsional)
                  </span>
                  <select
                    name="classId"
                    defaultValue=""
                    className="mt-1 w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Belum ditempatkan</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {majors.length > 0 ? (
                    <span className="mt-1 block text-[11px] text-[var(--slate)]">
                      Memilih kelas berjurusan akan menyesuaikan jurusan siswa.
                    </span>
                  ) : null}
                </label>
              </div>

              <div className="mt-3">
                <button
                  type="submit"
                  disabled={pending}
                  className="border-2 border-[var(--ink)] bg-[var(--board)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Memproses…" : "Jadikan siswa"}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}

/**
 * Label status. Warna dipakai untuk makna (diterima/ditolak), bukan hiasan —
 * panitia memindai puluhan baris, jadi warna mempermudah membedakan sekilas.
 */
function StatusPill({ status, label }: { status: string; label: string }) {
  const style =
    status === "ACCEPTED"
      ? { background: "#ecfdf5", borderColor: "#047857", color: "#065f46" }
      : status === "REJECTED"
        ? { background: "#fef2f2", borderColor: "#b91c1c", color: "#991b1b" }
        : status === "WAITLIST"
          ? { background: "#fffbeb", borderColor: "#b45309", color: "#92400e" }
          : { background: "var(--paper)", borderColor: "var(--chalk)", color: "var(--ink)" };

  return (
    <span
      className="inline-block border px-2 py-0.5 text-xs"
      style={style}
    >
      {label}
    </span>
  );
}
