"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigasi portal — ringkas dan ramah sentuh (ponsel).
 *
 * Enam tujuan saja. Portal ini untuk MEMBACA, jadi menu yang panjang justru
 * menyulitkan; yang tidak ada di sini memang tidak diperlukan orang tua
 * sehari-hari.
 */
const MENU = [
  { href: "/portal", label: "Ringkasan" },
  { href: "/portal/nilai", label: "Nilai" },
  { href: "/portal/kehadiran", label: "Kehadiran" },
  { href: "/portal/tagihan", label: "Tagihan" },
  { href: "/portal/jadwal", label: "Jadwal" },
  { href: "/portal/pengumuman", label: "Pengumuman" },
] as const;

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu portal" className="mt-4 -mb-px overflow-x-auto">
      <ul className="flex gap-1">
        {MENU.map((m) => {
          // "/portal" hanya aktif saat persis; sub-halaman punya sorotannya
          // sendiri agar "Ringkasan" tidak ikut menyala di semua halaman.
          const aktif =
            m.href === "/portal"
              ? pathname === "/portal"
              : pathname.startsWith(m.href);

          return (
            <li key={m.href}>
              <Link
                href={m.href}
                aria-current={aktif ? "page" : undefined}
                className={
                  "inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors " +
                  (aktif
                    ? "border-board font-medium text-ink"
                    : "border-transparent text-slate hover:text-ink")
                }
              >
                {m.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
