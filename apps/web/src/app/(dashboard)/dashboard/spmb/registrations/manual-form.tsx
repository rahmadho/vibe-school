"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { createManualRegistration } from "../admission-actions";

/**
 * Form catat pendaftaran manual — untuk pendaftar yang datang langsung ke
 * sekolah atau mendaftar lewat telepon.
 *
 * ============================================================
 * KENAPA FORM INI TERPISAH DARI TABEL PENDAFTAR
 * ============================================================
 * Tabel pendaftar dipakai untuk MENINJAU yang sudah masuk. Mencatat pendaftar
 * baru adalah pekerjaan berbeda — panitia sedang berhadapan dengan orang tua,
 * dan perlu form yang bisa diisi cepat sambil berbicara. Karena itu form ini
 * dibuka lewat satu tombol, bukan disisipkan ke dalam tabel.
 *
 * ============================================================
 * KENAPA BANYAK KOLOM OPSIONAL
 * ============================================================
 * Panitia sering hanya mencatat yang penting dulu (nama, orang tua, kontak)
 * dan melengkapi sisanya setelah orang tua pulang. Memaksa semua kolom wajib
 * membuat panitia mengetik asal-asalan agar bisa lanjut — dan data asal-asalan
 * lebih buruk daripada data kosong.
 */
export function ManualRegistrationForm({
  batches,
  onDone,
}: {
  batches: Array<{
    id: string;
    name: string;
    paths: Array<{ id: string; name: string; code: string }>;
  }>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");

  const fe = (n: string) => (!result || result.ok ? undefined : result.fieldErrors?.[n]?.[0]);
  const paths = batches.find((b) => b.id === batchId)?.paths ?? [];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);

    const fd = new FormData(e.currentTarget);
    fd.set("batchId", batchId);

    startTransition(async () => {
      const r = await createManualRegistration(fd);
      setResult(r);
      if (r.ok) {
        router.refresh();
        onDone();
      }
    });
  }

  if (batches.length === 0) {
    return (
      <div className="border-2 border-dashed border-[var(--chalk)] bg-white p-6 text-center">
        <p className="font-display text-lg text-[var(--ink)]">
          Belum ada gelombang pendaftaran
        </p>
        <p className="mx-auto mt-1 max-w-prose text-sm text-[var(--slate)]">
          Pendaftaran manual memerlukan gelombang. Buat gelombang terlebih
          dahulu di halaman SPMB.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormError message={result && !result.ok ? result.error : null} />

      {/* ---- Gelombang & jalur ---- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gelombang" htmlFor="batchId" error={fe("batchId")}>
          <Select
            id="batchId"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            required
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Jalur" htmlFor="pathId" error={fe("pathId")}>
          <Select id="pathId" name="pathId" required>
            {paths.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Sumber pendaftaran"
          htmlFor="source"
          error={fe("source")}
          hint="Untuk laporan: memisahkan pendaftar online dari yang datang langsung."
        >
          <Select id="source" name="source" defaultValue="WALK_IN">
            <option value="WALK_IN">Datang langsung ke sekolah</option>
            <option value="PHONE">Telepon / WhatsApp</option>
          </Select>
        </Field>

        <Field
          label="Nomor pendaftaran (opsional)"
          htmlFor="registrationNo"
          error={fe("registrationNo")}
          hint="Kosongkan agar dibuat otomatis. Isi bila menyesuaikan buku register sekolah."
        >
          <Input
            id="registrationNo"
            name="registrationNo"
            className="font-mono"
            placeholder="otomatis"
          />
        </Field>
      </div>

      {/* ---- Data calon ---- */}
      <fieldset className="space-y-4 border-t border-[var(--chalk)] pt-4">
        <legend className="text-sm font-medium text-[var(--ink)]">
          Data calon murid
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap" htmlFor="fullName" error={fe("fullName")}>
            <Input id="fullName" name="fullName" required />
          </Field>

          <Field label="Jenis kelamin" htmlFor="gender" error={fe("gender")}>
            <Select id="gender" name="gender" required defaultValue="">
              <option value="" disabled>
                Pilih…
              </option>
              <option value="MALE">Laki-laki</option>
              <option value="FEMALE">Perempuan</option>
            </Select>
          </Field>

          <Field label="Tempat lahir (opsional)" htmlFor="birthPlace" error={fe("birthPlace")}>
            <Input id="birthPlace" name="birthPlace" />
          </Field>

          <Field label="Tanggal lahir (opsional)" htmlFor="birthDate" error={fe("birthDate")}>
            <Input id="birthDate" name="birthDate" type="date" />
          </Field>

          <Field label="Agama (opsional)" htmlFor="religion" error={fe("religion")}>
            <Input id="religion" name="religion" />
          </Field>

          <Field label="Sekolah asal (opsional)" htmlFor="previousSchool" error={fe("previousSchool")}>
            <Input id="previousSchool" name="previousSchool" />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Alamat (opsional)" htmlFor="address" error={fe("address")}>
              <Input id="address" name="address" />
            </Field>
          </div>
        </div>
      </fieldset>

      {/* ---- Data wali ---- */}
      <fieldset className="space-y-4 border-t border-[var(--chalk)] pt-4">
        <legend className="text-sm font-medium text-[var(--ink)]">
          Orang tua / wali
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama orang tua / wali" htmlFor="parentName" error={fe("parentName")}>
            <Input id="parentName" name="parentName" required />
          </Field>

          <Field
            label="Nomor WhatsApp"
            htmlFor="parentPhone"
            error={fe("parentPhone")}
            hint="Dipakai orang tua untuk mengecek status dan menerima pengumuman."
          >
            <Input
              id="parentPhone"
              name="parentPhone"
              placeholder="081234567890"
              className="tabular-nums"
              required
            />
          </Field>

          <Field label="Hubungan" htmlFor="parentRelation" error={fe("parentRelation")}>
            <Select id="parentRelation" name="parentRelation" required defaultValue="">
              <option value="" disabled>
                Pilih…
              </option>
              <option value="FATHER">Ayah</option>
              <option value="MOTHER">Ibu</option>
              <option value="GUARDIAN">Wali</option>
            </Select>
          </Field>

          <Field label="Kontak pendaftar (opsional)" htmlFor="phone" error={fe("phone")}>
            <Input id="phone" name="phone" placeholder="081234567890" className="tabular-nums" />
          </Field>

          <Field label="Email (opsional)" htmlFor="email" error={fe("email")}>
            <Input id="email" name="email" type="email" />
          </Field>
        </div>
      </fieldset>

      {/* ---- Catatan & pilihan ---- */}
      <fieldset className="space-y-3 border-t border-[var(--chalk)] pt-4">
        <legend className="text-sm font-medium text-[var(--ink)]">Catatan panitia</legend>

        <Field label="Catatan (opsional)" htmlFor="note" error={fe("note")}>
          <Input
            id="note"
            name="note"
            placeholder="Mis. berkas kurang fotokopi akta, menyusul."
          />
        </Field>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="markVerified"
            defaultChecked
            className="mt-0.5 h-4 w-4 accent-[var(--board)]"
          />
          <span>
            <span className="block text-sm font-medium text-[var(--ink)]">
              Berkas sudah diperiksa — tandai &ldquo;Dokumen lengkap&rdquo;
            </span>
            <span className="mt-0.5 block text-xs text-[var(--slate)]">
              Untuk pendaftar yang datang langsung, berkasnya sudah dilihat di
              depan panitia sehingga tidak perlu menunggu verifikasi lagi.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="notify"
            className="mt-0.5 h-4 w-4 accent-[var(--board)]"
          />
          <span>
            <span className="block text-sm font-medium text-[var(--ink)]">
              Kirim nomor pendaftaran lewat WhatsApp
            </span>
            <span className="mt-0.5 block text-xs text-[var(--slate)]">
              Untuk pendaftaran lewat telepon, pesan ini menjadi bukti
              pendaftaran sudah tercatat.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-[var(--chalk)] pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Catat pendaftaran"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Batal
        </Button>
        {result?.ok ? (
          <span role="status" className="text-sm text-[var(--board)]">
            Tersimpan.
          </span>
        ) : null}
      </div>
    </form>
  );
}
