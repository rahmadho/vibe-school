import type { Metadata } from "next";
import { resolveSchoolFromRequest, publicErrorPage } from "@/lib/site-server";
import {
  getEffectiveTheme,
  getPublicNavigation,
  getSiteConfig,
  getSchoolIdentity,
  listNavPages,
} from "@/lib/data/site";
import { SiteFooter, SiteHeader } from "@/components/site/site-nav";

/**
 * Layout untuk SEMUA halaman web sekolah publik.
 *
 * Dua hal penting yang terjadi di sini:
 *
 * 1. RESOLUSI SEKOLAH — sekolah ditentukan dari nama host (subdomain), bukan
 *    dari parameter yang bisa dipalsukan pengunjung. Semua halaman di bawah
 *    layout ini sudah pasti milik satu sekolah.
 *
 * 2. INJEKSI TEMA — warna sekolah disuntikkan sebagai CSS variable. Inilah
 *    yang membuat "satu mesin, banyak wajah" bekerja: komponen blok menulis
 *    `var(--site-primary)`, dan nilainya berbeda per sekolah.
 */

/** Variable CSS yang membentuk identitas visual sebuah sekolah. */
function themeStyle(theme: Awaited<ReturnType<typeof getEffectiveTheme>>) {
  return {
    "--site-primary": theme.primary,
    "--site-primary-text": theme.primaryText,
    "--site-accent": theme.accent,
    "--site-accent-text": theme.accentText,
    "--site-bg": theme.background,
    "--site-surface": theme.surface,
    "--site-text": theme.text,
    "--site-muted": theme.mutedText,
    "--site-border": theme.border,
    "--site-radius-card": theme.radiusCard,
    "--site-radius-button": theme.radiusButton,
    "--site-heading-font": `var(${theme.headingFontVar})`,
    "--site-body-font": `var(${theme.bodyFontVar})`,
  } as React.CSSProperties;
}

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") return { title: "Web Sekolah" };

  const config = await getSiteConfig(ctx.school.id);
  return {
    title: {
      default: config?.tagline
        ? `${ctx.school.name} — ${config.tagline}`
        : ctx.school.name,
      template: `%s | ${ctx.school.name}`,
    },
    description: config?.shortDescription ?? undefined,
    icons: ctx.school.logoUrl ? { icon: ctx.school.logoUrl } : undefined,
  };
}

export default async function PublicSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await resolveSchoolFromRequest();

  // Domain utama atau sekolah tidak ditemukan: tampilkan halaman penjelasan,
  // bukan galat mentah. Pengunjung tidak boleh melihat jejak teknis.
  if (ctx.status !== "ok") {
    const info = publicErrorPage(ctx);
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="site-fade max-w-md text-center">
          {/*
            SVG sebaris, bukan emoji: emoji tampil berbeda di setiap sistem
            operasi dan tidak bisa diwarnai. Halaman ini justru halaman pertama
            yang dilihat pengunjung saat sekolah belum ditemukan — kesan
            pertamanya harus rapi.
          */}
          <div className="mb-5 flex justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-slate-400"
              aria-hidden="true"
            >
              <path d="M3 20.5h18M5 20.5V9l7-4.5 7 4.5v11.5" />
              <path d="M9.5 20.5v-5h5v5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{info.title}</h1>
          <p className="mt-3 text-sm text-slate-600">{info.message}</p>
          <p className="mt-2 text-xs text-slate-500">{info.hint}</p>
        </div>
      </div>
    );
  }

  const { school } = ctx;
  const [theme, config, nav, identity, navPages] = await Promise.all([
    getEffectiveTheme(school.id),
    getSiteConfig(school.id),
    getPublicNavigation(school.id),
    getSchoolIdentity(school.id),
    listNavPages(school.id),
  ]);

  const contact = {
    address: identity?.address,
    phone: identity?.phone,
    email: identity?.email,
    mapsUrl: config?.mapsUrl,
    officeHours: config?.officeHours,
    contactWa: config?.contactWa,
    facebookUrl: config?.facebookUrl,
    instagramUrl: config?.instagramUrl,
    youtubeUrl: config?.youtubeUrl,
    tiktokUrl: config?.tiktokUrl,
  };

  // Halaman yang dibuat sekolah ikut masuk menu, jadi operator tidak perlu
  // mendaftarkan menu dua kali.
  const pageItems = navPages.map((p) => ({
    label: p.title,
    href: `/${p.slug}`,
    isExternal: false,
  }));

  const headerItems = [
    ...nav.header.map((n) => ({
      label: n.label,
      href: n.href,
      isExternal: n.isExternal,
    })),
    ...pageItems,
  ];

  return (
    <div
      style={themeStyle(theme)}
      className="min-h-screen bg-[var(--site-bg)] font-[family-name:var(--site-body-font)] text-[var(--site-text)]"
    >
      <SiteHeader
        schoolName={school.name}
        logoUrl={school.logoUrl}
        tagline={config?.tagline}
        navItems={headerItems}
      />
      <main>{children}</main>
      <SiteFooter
        schoolName={school.name}
        logoUrl={school.logoUrl}
        contact={contact}
        navItems={nav.footer.map((n) => ({
          label: n.label,
          href: n.href,
          isExternal: n.isExternal,
        }))}
        year={new Date().getFullYear()}
      />
    </div>
  );
}
