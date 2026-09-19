import Link from "next/link";
import { guard } from "@/lib/action-guard";
import {
  getEditableBlocks,
  getSiteConfig,
  getEffectiveTheme,
} from "@/lib/data/site";
import { buildInitialLayout, DEFAULT_HOMEPAGE_LAYOUT } from "@/lib/site-blocks";
import { THEME_PRESETS } from "@/lib/site-themes";
import { prisma } from "@/lib/prisma";
import { LayoutEditor } from "./layout-editor";

/**
 * Halaman pengaturan web sekolah.
 *
 * Ini pintu utama operator mengubah "wajah" sekolah di internet. Tiga hal
 * ditampilkan berdampingan karena saling bergantung: SUSUNAN blok, TEMA warna,
 * dan ALAMAT web.
 */

export const metadata = { title: "Web Sekolah" };
export const dynamic = "force-dynamic";

export default async function WebsitePage() {
  const g = await guard("website", "read");
  if ("fail" in g) return <Denied message={g.fail.ok ? "Tidak diizinkan." : g.fail.error} />;

  const { schoolId } = g.ctx;

  const [config, theme, savedBlocks, school] = await Promise.all([
    getSiteConfig(schoolId),
    getEffectiveTheme(schoolId),
    getEditableBlocks(schoolId),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, slug: true, level: true, logoUrl: true },
    }),
  ]);

  // Sekolah baru belum punya blok tersimpan. Tampilkan susunan bawaan supaya
  // operator melihat titik awal yang masuk akal, bukan halaman kosong.
  const initialBlocks =
    savedBlocks.length > 0
      ? savedBlocks.map((b) => ({
          blockKey: b.blockKey,
          variantKey: b.variantKey,
          order: b.order,
          isEnabled: b.isEnabled,
          isSaved: true,
        }))
      : buildInitialLayout(DEFAULT_HOMEPAGE_LAYOUT).map((b) => ({
          blockKey: b.blockKey,
          variantKey: b.variantKey,
          order: b.order,
          isEnabled: true,
          isSaved: false,
        }));

  const presetKey = theme.presetKey;
  const presetName =
    THEME_PRESETS.find((p) => p.key === theme.presetKey)?.name ?? theme.presetKey;

  // Seberapa lengkap web sekolah ini — sekolah baru sering bingung harus
  // mengisi apa, jadi kelengkapan ditampilkan sebagai daftar periksa.
  const checks = [
    { label: "Logo sekolah", done: Boolean(school?.logoUrl), href: "/dashboard/settings" },
    { label: "Kalimat pengantar (tagline)", done: Boolean(config?.tagline), href: "/dashboard/website/settings" },
    { label: "Deskripsi singkat", done: Boolean(config?.shortDescription), href: "/dashboard/website/settings" },
    { label: "Nomor WhatsApp humas", done: Boolean(config?.contactWa), href: "/dashboard/website/settings" },
    { label: "Alamat web sudah diisi", done: Boolean(school?.slug), href: "/dashboard/website/settings" },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const percent = Math.round((doneCount / checks.length) * 100);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="border-b-2 border-[var(--ink)] pb-4">
        <p className="text-sm text-[var(--slate)]">Web Sekolah</p>
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
          {school?.name ?? "Sekolah"}
        </h1>
        <p className="mt-1 text-sm text-[var(--slate)]">
          Atur tampilan dan isi website publik sekolah. Perubahan langsung terlihat
          setelah disimpan.
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link
            href="/dashboard/website/settings"
            className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 hover:border-[var(--ink)]"
          >
            Identitas & Kontak
          </Link>
          <Link
            href="/dashboard/website/theme"
            className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 hover:border-[var(--ink)]"
          >
            Tema & Warna
          </Link>
          <Link
            href="/dashboard/website/pages"
            className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 hover:border-[var(--ink)]"
          >
            Halaman
          </Link>
          <Link
            href="/dashboard/website/navigation"
            className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 hover:border-[var(--ink)]"
          >
            Menu
          </Link>
        </div>
      </header>

      {/* Status kelengkapan — memberi tahu operator apa yang masih kurang. */}
      <section className="border-2 border-[var(--chalk)] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-[var(--ink)]">
            Kelengkapan web sekolah
          </h2>
          <span className="font-mono text-sm text-[var(--slate)]">
            {doneCount}/{checks.length} · {percent}%
          </span>
        </div>

        <div
          className="mt-2 h-2 w-full border border-[var(--chalk)] bg-[var(--paper)]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Kelengkapan web sekolah"
        >
          <div className="h-full bg-[var(--marker)]" style={{ width: `${percent}%` }} />
        </div>

        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              <span aria-hidden className={c.done ? "text-emerald-700" : "text-[var(--slate)]"}>
                {c.done ? "✓" : "○"}
              </span>
              <span className={c.done ? "text-[var(--ink)]" : "text-[var(--slate)]"}>
                {c.label}
              </span>
              {!c.done && (
                <Link href={c.href} className="text-xs text-[var(--ink)] underline">
                  isi
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <LayoutEditor
        initialBlocks={initialBlocks}
        schoolName={school?.name ?? "sekolah"}
      />

      {/* Ringkasan tema — perubahan penuh ada di halaman Tema. */}
      <section className="border-2 border-[var(--chalk)] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--ink)]">
              Tema saat ini
            </h2>
            <p className="mt-0.5 text-sm text-[var(--slate)]">{presetName}</p>
          </div>
          <div className="flex items-center gap-2">
            {[theme.primary, theme.accent, theme.background, theme.surface].map((c) => (
              <span
                key={c}
                title={c}
                className="inline-block h-6 w-6 border-2 border-[var(--ink)]"
                style={{ backgroundColor: c }}
              />
            ))}
            <Link
              href="/dashboard/website/theme"
              className="ml-2 border-2 border-[var(--chalk)] bg-white px-3 py-1.5 text-sm hover:border-[var(--ink)]"
            >
              Ubah tema
            </Link>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--slate)]">
          Preset terpilih: <span className="font-mono">{presetKey}</span>
        </p>
      </section>

      {/* Alamat web — subdomain adalah identitas publik sekolah. */}
      <section className="border-2 border-[var(--chalk)] bg-white p-4">
        <h2 className="font-display text-base font-semibold text-[var(--ink)]">
          Alamat web sekolah
        </h2>
        <p className="mt-1 text-sm text-[var(--slate)]">
          Web sekolah dapat diakses di alamat berikut. Atur di halaman Identitas & Kontak.
        </p>
        <p className="mt-2 border border-[var(--chalk)] bg-[var(--paper)] px-3 py-2 font-mono text-sm text-[var(--ink)]">
          https://{school?.slug}.sekolah.id
        </p>
      </section>
    </div>
  );
}

function Denied({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md border-2 border-[var(--chalk)] bg-white p-6 text-center">
      <p className="font-display text-lg font-semibold text-[var(--ink)]">Tidak dapat diakses</p>
      <p className="mt-2 text-sm text-[var(--slate)]">{message}</p>
    </div>
  );
}
