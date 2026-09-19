"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveSiteConfig,
  updateSchoolSlug,
} from "@/app/(dashboard)/dashboard/website/actions";
import type { ActionResult } from "@/lib/action-result";

/**
 * Form identitas & kontak web sekolah.
 *
 * Dua hal disatukan di sini karena sama-sama "identitas publik":
 *  1. ISI  — tagline, deskripsi, kontak, sosial media, mode halaman depan.
 *  2. ALAMAT — subdomain sekolah.
 *
 * Alamat sengaja dipisah dalam kotak sendiri dengan peringatan jelas: mengubah
 * subdomain mematikan semua tautan lama, jadi operator harus melihat akibatnya
 * sebelum menekan simpan.
 */

type ConfigShape = {
  tagline: string;
  shortDescription: string;
  homepageMode: string;
  beritaUrl: string;
  contactWa: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  mapsUrl: string;
  officeHours: string;
};

export function SettingsForm({
  config,
  schoolName,
  slug,
}: {
  config: ConfigShape;
  schoolName: string;
  slug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const [form, setForm] = useState<ConfigShape>(config);
  const fe = (n: string) => (!result || result.ok ? undefined : result.fieldErrors?.[n]?.[0]);

  function set<K extends keyof ConfigShape>(key: K, value: ConfigShape[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Checkbox: FormData hanya mengirim nilai saat dicentang; pastikan mode
    // halaman depan selalu terkirim karena ia <select>, bukan checkbox.
    fd.set("homepageMode", form.homepageMode);
    startTransition(async () => {
      const r = await saveSiteConfig(fd);
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <header className="border-b-2 border-[var(--ink)] pb-3">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
          Identitas &amp; kontak
        </h2>
        <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
          Kalimat, kontak, dan tautan yang tampil di seluruh halaman web{" "}
          {schoolName}. Semakin lengkap, semakin mudah orang tua menghubungi
          sekolah.
        </p>
      </header>

      <FormBanner result={result} />

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* ---- Kalimat pengantar ---- */}
        <section className="border-2 border-[var(--rule)] bg-white p-4">
          <h3 className="text-sm font-semibold text-[var(--ink)]">
            Kalimat pengantar
          </h3>

          <div className="mt-3 space-y-3">
            <Field
              label="Tagline"
              hint="Satu kalimat singkat di header, mis. “Unggul dalam prestasi, santun dalam perilaku”."
              error={fe("tagline")}
            >
              <input
                type="text"
                name="tagline"
                maxLength={120}
                value={form.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 text-sm"
              />
            </Field>

            <Field
              label="Deskripsi singkat"
              hint="Muncul di halaman depan. Jelaskan sekolah dalam dua-tiga kalimat."
              error={fe("shortDescription")}
            >
              <textarea
                name="shortDescription"
                rows={4}
                maxLength={400}
                value={form.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 text-sm"
              />
            </Field>
          </div>
        </section>

        {/* ---- Halaman depan ---- */}
        <section className="border-2 border-[var(--rule)] bg-white p-4">
          <h3 className="text-sm font-semibold text-[var(--ink)]">
            Halaman depan
          </h3>
          <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
            Pilih apakah beranda disusun dari blok, atau menampilkan satu
            halaman yang Anda tulis sendiri.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Mode halaman depan" error={fe("homepageMode")}>
              <select
                name="homepageMode"
                value={form.homepageMode}
                onChange={(e) => set("homepageMode", e.target.value)}
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 text-sm"
              >
                <option value="BLOCKS">Susunan blok (bawaan)</option>
                <option value="SINGLE">Satu halaman tulisan</option>
              </select>
            </Field>

            <Field
              label="Alamat berita (opsional)"
              hint="Kosongkan untuk memakai halaman berita bawaan. Isi bila berita dikelola di web lain."
              error={fe("beritaUrl")}
            >
              <input
                type="text"
                name="beritaUrl"
                value={form.beritaUrl}
                onChange={(e) => set("beritaUrl", e.target.value)}
                placeholder="https://…"
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 font-mono text-sm"
              />
            </Field>
          </div>
        </section>

        {/* ---- Kontak ---- */}
        <section className="border-2 border-[var(--rule)] bg-white p-4">
          <h3 className="text-sm font-semibold text-[var(--ink)]">Kontak</h3>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field
              label="Nomor WhatsApp humas"
              hint="Dipakai tombol “Hubungi Kami”. Contoh: 081234567890."
              error={fe("contactWa")}
            >
              <input
                type="tel"
                name="contactWa"
                value={form.contactWa}
                onChange={(e) => set("contactWa", e.target.value)}
                placeholder="081234567890"
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 font-mono text-sm"
              />
            </Field>

            <Field
              label="Jam layanan"
              hint="Mis. “Senin–Jumat, 07.00–15.00 WIB”."
              error={fe("officeHours")}
            >
              <input
                type="text"
                name="officeHours"
                maxLength={200}
                value={form.officeHours}
                onChange={(e) => set("officeHours", e.target.value)}
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 text-sm"
              />
            </Field>
          </div>

          <div className="mt-3">
            <Field
              label="Tautan peta (opsional)"
              hint="Tempel tautan Google Maps sekolah agar pengunjung mudah menemukan lokasi."
              error={fe("mapsUrl")}
            >
              <input
                type="text"
                name="mapsUrl"
                value={form.mapsUrl}
                onChange={(e) => set("mapsUrl", e.target.value)}
                placeholder="https://maps.google.com/…"
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 font-mono text-sm"
              />
            </Field>
          </div>
        </section>

        {/* ---- Sosial media ---- */}
        <section className="border-2 border-[var(--rule)] bg-white p-4">
          <h3 className="text-sm font-semibold text-[var(--ink)]">
            Sosial media{" "}
            <span className="font-normal text-[var(--ink-soft)]">(opsional)</span>
          </h3>
          <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
            Kosongkan yang tidak dipakai — ikonnya otomatis disembunyikan.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Facebook" error={fe("facebookUrl")}>
              <input
                type="text"
                name="facebookUrl"
                value={form.facebookUrl}
                onChange={(e) => set("facebookUrl", e.target.value)}
                placeholder="https://facebook.com/…"
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 font-mono text-sm"
              />
            </Field>
            <Field label="Instagram" error={fe("instagramUrl")}>
              <input
                type="text"
                name="instagramUrl"
                value={form.instagramUrl}
                onChange={(e) => set("instagramUrl", e.target.value)}
                placeholder="https://instagram.com/…"
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 font-mono text-sm"
              />
            </Field>
            <Field label="YouTube" error={fe("youtubeUrl")}>
              <input
                type="text"
                name="youtubeUrl"
                value={form.youtubeUrl}
                onChange={(e) => set("youtubeUrl", e.target.value)}
                placeholder="https://youtube.com/…"
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 font-mono text-sm"
              />
            </Field>
            <Field label="TikTok" error={fe("tiktokUrl")}>
              <input
                type="text"
                name="tiktokUrl"
                value={form.tiktokUrl}
                onChange={(e) => set("tiktokUrl", e.target.value)}
                placeholder="https://tiktok.com/…"
                className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 font-mono text-sm"
              />
            </Field>
          </div>
        </section>

        <div className="flex items-center gap-3 border-t-2 border-[var(--rule)] pt-4">
          <button
            type="submit"
            disabled={pending}
            className="border-2 border-[var(--ink)] bg-[var(--marker)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
          >
            {pending ? "Menyimpan…" : "Simpan pengaturan"}
          </button>
          {result?.ok && (
            <span className="text-sm text-emerald-800">Pengaturan tersimpan.</span>
          )}
        </div>
      </form>

      {/* ---- Alamat web (subdomain) ---- */}
      <SlugBox initialSlug={slug} />
    </div>
  );
}

/**
 * Kotak perubahan subdomain.
 *
 * Dipisah dari form utama karena mengubahnya punya akibat berbeda: semua
 * tautan lama mati. Form terpisah memaksa operator berhenti dan membaca
 * peringatannya, bukan menyimpannya bersama perubahan lain tanpa sadar.
 */
function SlugBox({ initialSlug }: { initialSlug: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const changed = slug.trim().toLowerCase() !== initialSlug;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("slug", slug);
    startTransition(async () => {
      const r = await updateSchoolSlug(fd);
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="border-2 border-[var(--rule)] bg-white p-4">
      <h3 className="text-sm font-semibold text-[var(--ink)]">Alamat web sekolah</h3>
      <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
        Ini alamat yang dibagikan ke orang tua. Huruf kecil, angka, dan tanda
        hubung.
      </p>

      <FormBanner result={result} />

      <form onSubmit={onSubmit} className="mt-3" noValidate>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-[var(--ink-soft)]">https://</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            aria-label="Alamat web sekolah"
            className="min-w-0 flex-1 border border-[var(--rule)] bg-white px-2 py-1.5 font-mono text-sm"
          />
          <span className="font-mono text-sm text-[var(--ink-soft)]">
            .sekolah.id
          </span>
          <button
            type="submit"
            disabled={pending || !changed}
            className="border-2 border-[var(--rule)] bg-white px-3 py-1.5 text-sm hover:border-[var(--ink)] disabled:opacity-40"
          >
            {pending ? "Menyimpan…" : "Ubah alamat"}
          </button>
        </div>

        {changed && (
          <p className="mt-2 border-l-4 border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Perhatian.</strong> Mengubah alamat berarti tautan lama tidak
            lagi berfungsi. Beri tahu orang tua dan bagikan alamat baru setelah
            disimpan.
          </p>
        )}
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && (
        <span className="mt-1 block text-[11px] leading-snug text-[var(--ink-soft)]">
          {hint}
        </span>
      )}
      {error && (
        <span className="mt-1 block text-[11px] text-red-800">{error}</span>
      )}
    </label>
  );
}

function FormBanner({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (!result.ok) {
    return (
      <p className="mt-3 border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
        {result.error}
      </p>
    );
  }
  if (result.message) {
    return (
      <p className="mt-3 border-l-4 border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {result.message}
      </p>
    );
  }
  return null;
}
