import Link from "next/link";
import type { ContactInfo } from "@/components/site/blocks/contact";

/**
 * Navigasi web sekolah: SiteHeader (lengket) dan SiteFooter.
 *
 * Keduanya sengaja TANPA "use client": seluruh interaktivitas memakai elemen
 * HTML asli. Menu mobile dibuka lewat <details>/<summary> sehingga tidak perlu
 * state JavaScript sama sekali.
 */

export type NavItem = {
  label: string;
  href: string;
  isExternal: boolean;
};

/**
 * Satu tautan menu.
 *
 * Tautan luar memakai <a> agar tidak melalui router internal Next.js;
 * tautan internal memakai next/link supaya navigasi terasa seketika.
 */
function NavLink({
  item,
  currentPath,
  className = "",
}: {
  item: NavItem;
  currentPath?: string;
  className?: string;
}) {
  const active = !item.isExternal && currentPath === item.href;
  const activeCls = active
    ? "font-semibold text-[var(--site-primary)] underline underline-offset-4"
    : "text-[var(--site-text)] hover:text-[var(--site-primary)]";

  const cls = `${className} ${activeCls}`.trim();

  if (item.isExternal) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined}>
      {item.label}
    </Link>
  );
}

/* ============================================================
 * HEADER
 * ============================================================ */

/** Header lengket: logo + nama sekolah di kiri, menu navigasi di kanan. */
export function SiteHeader({
  schoolName,
  logoUrl,
  tagline,
  navItems,
  currentPath,
}: {
  schoolName: string;
  logoUrl?: string | null;
  tagline?: string | null;
  navItems: NavItem[];
  currentPath?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--site-border)] bg-[var(--site-surface)]">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Identitas sekolah */}
        <Link href="/" className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={schoolName} className="h-10 w-10 shrink-0 object-contain" />
          ) : null}
          <span className="flex flex-col">
            <span className="font-[family-name:var(--site-heading-font)] text-lg font-bold leading-tight text-[var(--site-text)]">
              {schoolName}
            </span>
            {tagline ? (
              <span className="text-xs text-[var(--site-muted)]">{tagline}</span>
            ) : null}
          </span>
        </Link>

        {navItems.length > 0 ? (
          <>
            {/* Menu desktop */}
            <nav className="hidden md:flex md:items-center md:gap-6">
              {navItems.map((item) => (
                <NavLink key={`${item.href}-${item.label}`} item={item} currentPath={currentPath} />
              ))}
            </nav>

            {/* Menu mobile — <details> asli, tanpa JavaScript */}
            <details className="relative md:hidden">
              <summary
                className="flex cursor-pointer list-none items-center gap-1 px-2 py-2 text-sm font-semibold text-[var(--site-text)]"
                aria-label="Buka menu"
              >
                <span aria-hidden="true">☰</span>
                <span>Menu</span>
              </summary>
              <nav className="absolute right-0 top-full z-50 mt-1 flex w-56 flex-col gap-1 border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-lg"
                style={{ borderRadius: "var(--site-radius-card)" }}
              >
                {navItems.map((item) => (
                  <NavLink
                    key={`m-${item.href}-${item.label}`}
                    item={item}
                    currentPath={currentPath}
                    className="px-2 py-2 text-sm"
                  />
                ))}
              </nav>
            </details>
          </>
        ) : null}
      </div>
    </header>
  );
}

/* ============================================================
 * FOOTER
 * ============================================================ */

/** Footer tiga kolom: identitas, menu, dan kontak. */
export function SiteFooter({
  schoolName,
  logoUrl,
  contact,
  navItems,
  year = new Date().getFullYear(),
}: {
  schoolName: string;
  logoUrl?: string | null;
  contact: ContactInfo;
  navItems: NavItem[];
  year?: number;
}) {
  const address = contact.address?.trim() || "";
  const phone = contact.phone?.trim() || "";
  const email = contact.email?.trim() || "";

  // Sosial media hanya tampil bila URL-nya ada.
  const socials = [
    { label: "Facebook", href: contact.facebookUrl?.trim() || "" },
    { label: "Instagram", href: contact.instagramUrl?.trim() || "" },
    { label: "YouTube", href: contact.youtubeUrl?.trim() || "" },
    { label: "TikTok", href: contact.tiktokUrl?.trim() || "" },
  ].filter((s) => s.href.length > 0);

  const hasContact = Boolean(address || phone || email || socials.length > 0);

  return (
    <footer className="border-t border-[var(--site-border)] bg-[var(--site-surface)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Kolom 1: identitas */}
          <div>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={schoolName} className="h-10 w-10 shrink-0 object-contain" />
              ) : null}
              <span className="font-[family-name:var(--site-heading-font)] text-lg font-bold text-[var(--site-text)]">
                {schoolName}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted)]">
              Sekolah yang menumbuhkan karakter dan prestasi peserta didik.
            </p>
          </div>

          {/* Kolom 2: menu footer */}
          {navItems.length > 0 ? (
            <div>
              <h3 className="font-[family-name:var(--site-heading-font)] text-sm font-semibold text-[var(--site-text)]">
                Menu
              </h3>
              <ul className="mt-3 space-y-2">
                {navItems.map((item) => (
                  <li key={`f-${item.href}-${item.label}`}>
                    <NavLink item={item} className="text-sm" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Kolom 3: kontak */}
          {hasContact ? (
            <div>
              <h3 className="font-[family-name:var(--site-heading-font)] text-sm font-semibold text-[var(--site-text)]">
                Kontak
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--site-muted)]">
                {address ? <li>{address}</li> : null}
                {phone ? (
                  <li>
                    <a href={`tel:${phone}`} className="hover:text-[var(--site-primary)]">
                      {phone}
                    </a>
                  </li>
                ) : null}
                {email ? (
                  <li>
                    <a href={`mailto:${email}`} className="hover:text-[var(--site-primary)]">
                      {email}
                    </a>
                  </li>
                ) : null}
                {socials.length > 0 ? (
                  <li className="flex flex-wrap gap-x-3 gap-y-1">
                    {socials.map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--site-primary)] hover:underline"
                      >
                        {s.label}
                      </a>
                    ))}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Baris hak cipta */}
        <div className="mt-10 flex flex-col gap-2 border-t border-[var(--site-border)] pt-6 text-xs text-[var(--site-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {schoolName}. Semua hak dilindungi.
          </p>
          <p>Ditenagai School App</p>
        </div>
      </div>
    </footer>
  );
}
