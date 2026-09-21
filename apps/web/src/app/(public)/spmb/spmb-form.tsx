"use client";

import { useState, useTransition } from "react";
import { submitPublicRegistration, type PublicActionResult } from "./actions";
import {
  SiteButton,
  SiteCard,
  formatSiteDate,
} from "@/components/site/site-ui";

/**
 * Formulir pendaftaran SPMB untuk umum.
 *
 * DIBAGI TIGA LANGKAH dengan sengaja: satu halaman berisi 12 isian membuat
 * orang tua berhenti di tengah. Tiga langkah pendek dengan kemajuan yang
 * terlihat membuat mereka menyelesaikan pendaftaran.
 *
 * Semua teks bantuan ditulis seperti menjelaskan ke orang tua, bukan ke
 * pengguna sistem: "nomor yang aktif WhatsApp" lebih jelas daripada "no. HP".
 */

/**
 * Bentuk data yang dikirim server ke form.
 *
 * Sengaja MENGIKUTI `PublicBatchPath`/`PublicBatch` dari lib/data/site.ts
 * (termasuk `remaining` dan `isFull`). Kalau form menghitung sendiri sisa kursi,
 * cepat atau lambat angkanya berbeda dari yang ditampilkan server — dan orang
 * tua melihat dua angka berbeda di satu halaman.
 */
export type PublicPath = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  registrationFee: number | null;
  quota: number;
  filled: number;
  remaining: number;
  isFull: boolean;
  requirements: string | null;
};

export type PublicBatch = {
  id: string;
  name: string;
  /** ISO string — Date tidak bisa dikirim sebagai props client component. */
  openDate: string;
  closeDate: string;
  /** Dihitung di server; form tidak menghitung ulang sendiri. */
  isOpen: boolean;
  phase: "belum" | "buka" | "tutup";
  description: string | null;
  requirements: string | null;
  paths: PublicPath[];
};

export function SpmbForm({
  batches,
  majors,
}: {
  batches: PublicBatch[];
  /** Jurusan/peminatan aktif sekolah. Kosong = sekolah tidak memakai jurusan. */
  majors: Array<{ id: string; code: string; name: string }>;
}) {
  const [step, setStep] = useState(1);
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [pathId, setPathId] = useState("");
  const [majorId, setMajorId] = useState(majors.length === 1 ? majors[0].id : "");
  const [result, setResult] = useState<PublicActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const batch = batches.find((b) => b.id === batchId) ?? null;
  const path = batch?.paths.find((p) => p.id === pathId) ?? null;

  // Sekolah dengan satu jalur tidak perlu repot memilih — langsung terpilih.
  if (batch && batch.paths.length === 1 && pathId !== batch.paths[0].id) {
    setPathId(batch.paths[0].id);
  }

  function submit(fd: FormData) {
    startTransition(async () => {
      const r = await submitPublicRegistration(fd);
      setResult(r);
      if (r.ok) window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- Selesai: tampilkan nomor pendaftaran ---------- */
  if (result?.ok) {
    return (
      <SiteCard className="p-6">
        <p className="text-sm text-[var(--site-muted)]">Pendaftaran berhasil dikirim</p>
        <h2 className="mt-1 font-[family-name:var(--site-heading-font)] text-xl font-semibold text-[var(--site-text)]">
          Simpan nomor pendaftaran ini
        </h2>
        <p
          className="mt-3 border-2 px-4 py-3 text-center font-mono text-2xl font-semibold tracking-wider"
          style={{ borderColor: "var(--site-primary)", color: "var(--site-primary)" }}
        >
          {result.registrationNo}
        </p>
        <p className="mt-3 text-sm text-[var(--site-muted)]">
          Gunakan nomor ini bersama nomor HP orang tua untuk memeriksa hasil seleksi
          di halaman <strong>Cek Status</strong>. Mohon disimpan atau disalin sekarang —
          nomor ini tidak dikirim ulang lewat SMS.
        </p>
        <div className="mt-4">
          <SiteButton href="/spmb/status">Cek status pendaftaran</SiteButton>
        </div>
      </SiteCard>
    );
  }

  if (!batch) {
    return (
      <SiteCard className="p-6">
        <p className="text-sm text-[var(--site-muted)]">
          Belum ada gelombang pendaftaran yang dibuka.
        </p>
      </SiteCard>
    );
  }

  return (
    <div className="space-y-4">
      {result && !result.ok && (
        <p className="border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
          {result.error}
        </p>
      )}

      <StepBar step={step} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 3) {
            setStep(step + 1);
            return;
          }
          submit(new FormData(e.currentTarget));
        }}
      >
        {/* Field yang dibawa antar-langkah — form ini satu, hanya tampilannya dibagi. */}
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="pathId" value={pathId} />
        <input type="hidden" name="majorId" value={majorId} />

        {step === 1 && (
          <SiteCard className="space-y-4 p-5">
            <h3 className="font-[family-name:var(--site-heading-font)] text-lg font-semibold text-[var(--site-text)]">
              Pilih jalur pendaftaran
            </h3>

            <label className="block text-sm">
              <span className="font-medium text-[var(--site-text)]">Gelombang</span>
              <select
                value={batchId}
                onChange={(e) => {
                  setBatchId(e.target.value);
                  setPathId("");
                }}
                className="mt-1 w-full border bg-transparent px-3 py-2 text-sm text-[var(--site-text)]"
                style={{ borderColor: "var(--site-border)" }}
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({formatSiteDate(b.openDate)} – {formatSiteDate(b.closeDate)})
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              {batch.paths.map((p) => {
                const full = p.isFull;
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-start gap-3 border p-3"
                    style={{
                      borderColor: pathId === p.id ? "var(--site-primary)" : "var(--site-border)",
                      borderRadius: "var(--site-radius-card)",
                      opacity: full ? 0.6 : 1,
                    }}
                  >
                    <input
                      type="radio"
                      name="pathChoice"
                      value={p.id}
                      checked={pathId === p.id}
                      disabled={full}
                      onChange={() => setPathId(p.id)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--site-text)]">{p.name}</span>
                        {full && (
                          <span className="text-xs text-[var(--site-muted)]">
                            (kuota penuh)
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-[var(--site-muted)]">
                        {p.registrationFee && p.registrationFee > 0
                          ? `Biaya pendaftaran ${rp(p.registrationFee)}`
                          : "Tidak dipungut biaya pendaftaran"}
                        {!full && ` · sisa ${p.remaining} kursi`}
                      </span>
                      {p.description && (
                        <span className="mt-1 block text-sm text-[var(--site-muted)]">
                          {p.description}
                        </span>
                      )}
                      {p.requirements && (
                        <span className="mt-1 block text-xs text-[var(--site-muted)]">
                          Syarat: {p.requirements}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Jurusan/peminatan: hanya muncul bila sekolah memilikinya.
                Sekolah SD/SMP tidak melihat field ini sama sekali. */}
            {majors.length > 0 && (
              <label className="block text-sm">
                <span className="font-medium text-[var(--site-text)]">
                  {majors.length === 1 ? "Jurusan" : "Pilih jurusan"}
                </span>
                <select
                  value={majorId}
                  onChange={(e) => setMajorId(e.target.value)}
                  className="mt-1 w-full border bg-transparent px-3 py-2 text-sm text-[var(--site-text)]"
                  style={{ borderColor: "var(--site-border)" }}
                >
                  <option value="">Belum menentukan pilihan</option>
                  {majors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-[var(--site-muted)]">
                  Boleh dikosongkan; panitia dapat menentukannya saat verifikasi.
                </span>
              </label>
            )}

            {batch.requirements && (
              <p className="border-t pt-3 text-sm text-[var(--site-muted)]"
                 style={{ borderColor: "var(--site-border)" }}>
                <strong className="text-[var(--site-text)]">Syarat umum:</strong>{" "}
                {batch.requirements}
              </p>
            )}
            <div className="pt-1">
              <button
                type="submit"
                disabled={!pathId}
                className="px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{
                  backgroundColor: "var(--site-primary)",
                  color: "var(--site-primary-text)",
                  borderRadius: "var(--site-radius-button)",
                }}
              >
                Lanjutkan
              </button>
            </div>
          </SiteCard>
        )}

        {step === 2 && (
          <SiteCard className="space-y-4 p-5">
            <h3 className="font-[family-name:var(--site-heading-font)] text-lg font-semibold text-[var(--site-text)]">
              Data calon murid
            </h3>

            <Field label="Nama lengkap" name="fullName" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[var(--site-text)]">Jenis kelamin</span>
                <select
                  name="gender"
                  required
                  className="mt-1 w-full border bg-transparent px-3 py-2 text-sm text-[var(--site-text)]"
                  style={{ borderColor: "var(--site-border)" }}
                >
                  <option value="">— pilih —</option>
                  <option value="MALE">Laki-laki</option>
                  <option value="FEMALE">Perempuan</option>
                </select>
              </label>
              <Field label="Agama" name="religion" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tempat lahir" name="birthPlace" />
              <Field label="Tanggal lahir" name="birthDate" type="date" />
            </div>
            <Field label="Alamat lengkap" name="address" textarea />

            <StepNav onBack={() => setStep(1)} nextLabel="Lanjutkan" />
          </SiteCard>
        )}

        {step === 3 && (
          <SiteCard className="space-y-4 p-5">
            <h3 className="font-[family-name:var(--site-heading-font)] text-lg font-semibold text-[var(--site-text)]">
              Data orang tua / wali
            </h3>

            <Field label="Nama orang tua / wali" name="parentName" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[var(--site-text)]">Hubungan</span>
                <select
                  name="parentRelation"
                  required
                  className="mt-1 w-full border bg-transparent px-3 py-2 text-sm text-[var(--site-text)]"
                  style={{ borderColor: "var(--site-border)" }}
                >
                  <option value="">— pilih —</option>
                  <option value="FATHER">Ayah</option>
                  <option value="MOTHER">Ibu</option>
                  <option value="GUARDIAN">Wali</option>
                </select>
              </label>
              <Field
                label="Nomor WhatsApp"
                name="parentPhone"
                required
                hint="Nomor yang aktif WhatsApp. Hasil seleksi dikirim ke nomor ini."
              />
            </div>
            <Field label="Sekolah asal" name="previousSchool" />

            <StepNav onBack={() => setStep(2)} nextLabel={pending ? "Mengirim…" : "Kirim pendaftaran"} disabled={pending} />
          </SiteCard>
        )}
      </form>
    </div>
  );
}

/* ---------- komponen kecil ---------- */

function StepBar({ step }: { step: number }) {
  const labels = ["Jalur", "Calon murid", "Orang tua"];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold"
            style={{
              borderColor: step > i ? "var(--site-primary)" : "var(--site-border)",
              backgroundColor: step > i ? "var(--site-primary)" : "transparent",
              color: step > i ? "var(--site-primary-text)" : "var(--site-muted)",
            }}
          >
            {i + 1}
          </span>
          <span className={step > i ? "text-[var(--site-text)]" : "text-[var(--site-muted)]"}>
            {l}
          </span>
          {i < labels.length - 1 && <span className="text-[var(--site-muted)]">—</span>}
        </li>
      ))}
    </ol>
  );
}

function StepNav({
  onBack,
  nextLabel,
  disabled,
}: {
  onBack: () => void;
  nextLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onBack}
        className="border px-4 py-2.5 text-sm"
        style={{ borderColor: "var(--site-border)", color: "var(--site-text)", borderRadius: "var(--site-radius-button)" }}
      >
        Kembali
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        style={{
          backgroundColor: "var(--site-primary)",
          color: "var(--site-primary-text)",
          borderRadius: "var(--site-radius-button)",
        }}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  textarea,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  hint?: string;
}) {
  const cls =
    "mt-1 w-full border bg-transparent px-3 py-2 text-sm text-[var(--site-text)]";
  return (
    <label className="block text-sm">
      <span className="font-medium text-[var(--site-text)]">
        {label}
        {!required && <span className="text-[var(--site-muted)]"> (opsional)</span>}
      </span>
      {textarea ? (
        <textarea
          name={name}
          rows={3}
          required={required}
          className={cls}
          style={{ borderColor: "var(--site-border)" }}
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          className={cls}
          style={{ borderColor: "var(--site-border)" }}
        />
      )}
      {hint && <span className="mt-1 block text-xs text-[var(--site-muted)]">{hint}</span>}
    </label>
  );
}

function rp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}
