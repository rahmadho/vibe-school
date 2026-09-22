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

  /*
   * Garis bawah yang "tumbuh" dari kiri saat disorot, bukan garis penuh yang
   * muncul mendadak. Dipakai `background-size` alih-alih `border-bottom`
   * supaya garisnya tidak menggeser tinggi baris menu — menu yang bergeser
   * sedikit saat kursor lewat terbaca sebagai halaman yang tidak stabil.
   *
   * Halaman aktif memakai garis penuh + warna utama: pengunjung perlu tahu
   * di mana ia berada tanpa harus membaca ulang seluruh menu.
   */
  const base =
    "relative transition-colors duration-200 ease-out bg-[linear-gradient(currentColor,currentColor)] bg-no-repeat bg-[length:0%_2px] bg-[position:0_100%] hover:bg-[length:100%_2px] motion-reduce:transition-none";

  const activeCls = active
    ? "font-semibold text-[var(--site-primary)] bg-[length:100%_2px]"
    : "text-[var(--site-text)] hover:text-[var(--site-primary)]";

  const cls = `${base} ${className} ${activeCls}`.trim();

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
    <header
      className="sticky top-0 z-40 border-b border-[var(--site-border)]"
      style={{
        /*
          Latar semi-tembus pandang BUKAN hiasan: saat pengunjung menggulir,
          isi halaman lewat di bawah header. Dengan latar pekat, peralihannya
          terasa seperti patahan; dengan sedikit tembus, halaman terbaca
          sebagai satu lembar yang bergerak di bawah judul.
          `backdrop-filter` diberi cadangan warna pekat untuk peramban lama.
        */
        backgroundColor: "color-mix(in srgb, var(--site-surface) 88%, transparent)",
        backdropFilter: "saturate(1.4) blur(10px)",
        WebkitBackdropFilter: "saturate(1.4) blur(10px)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-[clamp(1rem,4vw,1.5rem)] py-3">
        {/* Identitas sekolah */}
        <Link href="/" className="group flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={schoolName}
              className="h-10 w-10 shrink-0 object-contain transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:group-hover:scale-100"
            />
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

            {/*
              Menu mobile — <details> asli, tanpa JavaScript.
              Isi menu diberi animasi muncul supaya tidak "melompat" saat
              dibuka; `details[open]` hanya ada setelah dibuka, jadi animasinya
              otomatis berjalan sekali di setiap pembukaan.
            */}
            <details className="relative md:hidden">
              <summary
                className="flex cursor-pointer list-none items-center gap-1 border border-[var(--site-border)] px-3 py-2 text-sm font-semibold text-[var(--site-text)] transition-colors hover:border-[var(--site-primary)] hover:text-[var(--site-primary)]"
                style={{ borderRadius: "var(--site-radius-button)" }}
                aria-label="Buka menu"
              >
                <span aria-hidden="true">☰</span>
                <span>Menu</span>
              </summary>
              <nav
                className="absolute right-0 top-full z-50 mt-2 flex w-60 flex-col gap-1 border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-xl"
                style={{
                  borderRadius: "var(--site-radius-card)",
                  animation: "site-rise 320ms cubic-bezier(0.16, 1, 0.3, 1) both",
                }}
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
      <div className="mx-auto w-full max-w-6xl px-[clamp(1rem,4vw,1.5rem)] py-[clamp(2.5rem,6vw,4rem)]">
        <div className="grid gap-[clamp(1.75rem,4vw,2.5rem)] md:grid-cols-3">
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
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--site-muted)]">
              Sekolah yang menumbuhkan karakter dan prestasi peserta didik.
            </p>
          </div>

          {/* Kolom 2: menu footer */}
          {navItems.length > 0 ? (
            <div>
              <h3 className="font-[family-name:var(--site-heading-font)] text-sm font-semibold uppercase tracking-[0.12em] text-[var(--site-muted)]">
                Menu
              </h3>
              <ul className="mt-4 space-y-2.5">
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
              <h3 className="font-[family-name:var(--site-heading-font)] text-sm font-semibold uppercase tracking-[0.12em] text-[var(--site-muted)]">
                Kontak
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[var(--site-muted)]">
                {address ? <li className="leading-relaxed">{address}</li> : null}
                {phone ? (
                  <li>
                    <a
                      href={`tel:${phone}`}
                      className="transition-colors hover:text-[var(--site-primary)]"
                    >
                      {phone}
                    </a>
                  </li>
                ) : null}
                {email ? (
                  <li>
                    <a
                      href={`mailto:${email}`}
                      className="transition-colors hover:text-[var(--site-primary)]"
                    >
                      {email}
                    </a>
                  </li>
                ) : null}
                {socials.length > 0 ? (
                  <li className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
                    {socials.map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-[var(--site-border)] px-2.5 py-1 text-xs text-[var(--site-text)] transition-colors hover:border-[var(--site-primary)] hover:text-[var(--site-primary)]"
                        style={{ borderRadius: "var(--site-radius-button)" }}
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
        <div className="mt-[clamp(2rem,5vw,3rem)] flex flex-col gap-2 border-t border-[var(--site-border)] pt-6 text-xs text-[var(--site-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {schoolName}. Semua hak dilindungi.
          </p>
          <p>Ditenagai School App</p>
        </div>
      </div>
    </footer>
  );
}
