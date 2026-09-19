"use client";

import { useState, useTransition } from "react";
import { checkRegistrationStatus, type PublicStatusResult } from "../actions";
import { SiteCard } from "@/components/site/site-ui";

/**
 * Form cek status pendaftaran.
 *
 * MEMINTA DUA DATA dengan sengaja: nomor pendaftaran DAN nomor HP orang tua.
 * Nomor pendaftaran berformat mudah ditebak (mis. `SPMB-2026-0001`), jadi kalau
 * hanya nomor itu yang dipakai, siapa pun bisa menyisir dan membaca status
 * pendaftar lain. Nomor HP wali berperan sebagai kata sandi ringan.
 *
 * Yang ditampilkan pun sudah disamarkan server (nama depan saja, nomor HP
 * sebagian tertutup).
 */
export function StatusForm() {
  const [result, setResult] = useState<
    { ok: true; data: PublicStatusResult } | { ok: false; error: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    startTransition(async () => {
      const r = await checkRegistrationStatus(fd);
      setResult(r);
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <SiteCard className="space-y-4 p-5">
          <label className="block text-sm">
            <span className="font-medium text-[var(--site-text)]">Nomor pendaftaran</span>
            <input
              name="registrationNo"
              required
              autoComplete="off"
              placeholder="SPMB-2026-0001"
              className="mt-1 w-full border bg-transparent px-3 py-2 font-mono text-sm uppercase text-[var(--site-text)]"
              style={{ borderColor: "var(--site-border)" }}
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-[var(--site-text)]">
              Nomor HP orang tua / wali
            </span>
            <input
              name="phone"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="08123456789"
              className="mt-1 w-full border bg-transparent px-3 py-2 text-sm text-[var(--site-text)]"
              style={{ borderColor: "var(--site-border)" }}
            />
            <span className="mt-1 block text-xs text-[var(--site-muted)]">
              Nomor yang Anda isi saat mendaftar. Dipakai untuk memastikan bahwa
              yang membuka data ini benar-benar pemiliknya.
            </span>
          </label>

          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{
              backgroundColor: "var(--site-primary)",
              color: "var(--site-primary-text)",
              borderRadius: "var(--site-radius-button)",
            }}
          >
            {pending ? "Memeriksa…" : "Cek status"}
          </button>
        </SiteCard>
      </form>

      {result && !result.ok && (
        <p className="border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
          {result.error}
        </p>
      )}

      {result?.ok && <StatusCard data={result.data} />}
    </div>
  );
}

/**
 * Hasil status.
 *
 * Warna dipakai untuk MAKNA (diterima / ditolak / masih diproses). Orang tua
 * sering membuka halaman ini berulang kali sambil cemas, jadi status harus
 * terbaca dalam sekali lihat.
 */
function StatusCard({ data }: { data: PublicStatusResult }) {
  const tone =
    data.status === "ACCEPTED"
      ? { border: "#047857", bg: "#ecfdf5", fg: "#065f46" }
      : data.status === "REJECTED"
        ? { border: "#b91c1c", bg: "#fef2f2", fg: "#991b1b" }
        : data.status === "WAITLIST"
          ? { border: "#b45309", bg: "#fffbeb", fg: "#92400e" }
          : { border: "var(--site-border)", bg: "var(--site-surface)", fg: "var(--site-text)" };

  return (
    <SiteCard className="p-5">
      <div
        className="border-l-4 px-3 py-2"
        style={{ borderColor: tone.border, backgroundColor: tone.bg }}
      >
        <p className="text-xs uppercase tracking-wide" style={{ color: tone.fg }}>
          Status pendaftaran
        </p>
        <p
          className="font-[family-name:var(--site-heading-font)] text-lg font-semibold"
          style={{ color: tone.fg }}
        >
          {data.statusLabel}
        </p>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Nomor pendaftaran" value={data.registrationNo} mono />
        <Row label="Nama pendaftar" value={data.maskedName} />
        <Row label="No. HP terdaftar" value={data.maskedPhone} mono />
        <Row label="Gelombang" value={data.batchName} />
        <Row label="Jalur" value={data.pathName ?? "—"} />
        <Row label="Waktu mendaftar" value={fmt(data.submittedAt)} />
        {data.decidedAt && <Row label="Waktu keputusan" value={fmt(data.decidedAt)} />}
      </dl>

      {data.resultAnnouncement && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--site-border)" }}>
          <p className="text-sm font-medium text-[var(--site-text)]">Pengumuman</p>
          <p className="mt-1 whitespace-pre-line text-sm text-[var(--site-muted)]">
            {data.resultAnnouncement}
          </p>
          {data.resultDate && (
            <p className="mt-1 text-xs text-[var(--site-muted)]">
              Tanggal pengumuman: {fmt(data.resultDate)}
            </p>
          )}
        </div>
      )}

      {data.resultNote && (
        <p className="mt-4 border-l-4 border-[var(--site-border)] pl-3 text-sm text-[var(--site-muted)]">
          <span className="font-medium text-[var(--site-text)]">Catatan panitia: </span>
          {data.resultNote}
        </p>
      )}
    </SiteCard>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-[var(--site-muted)]">{label}</dt>
      <dd className={`${mono ? "font-mono " : ""}text-[var(--site-text)]`}>{value}</dd>
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
