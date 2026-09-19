"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { cx } from "./ui";

/**
 * Sidebar — navigasi per-role.
 * Menu ditentukan modul yang boleh diakses role (lihat lib/rbac.ts, modul map).
 * Desain: tenang, label jelas, tanpa ikon dekoratif berlebihan.
 */

type NavItem = { href: string; label: string };

/** Menu per modul. Fase 1: hanya halaman yang sudah ada. */
const MODULE_LINKS: Record<string, NavItem[]> = {
  audit: [{ href: "/dashboard/audit", label: "Log Aktivitas" }],
  users: [{ href: "/dashboard/users", label: "Pengguna" }],
  students: [{ href: "/dashboard/students", label: "Siswa" }],
  teachers: [
    { href: "/dashboard/teachers", label: "Guru" },
    { href: "/dashboard/staff", label: "Staf" },
  ],
  academic: [
    { href: "/dashboard/academic/years", label: "Tahun ajaran" },
    { href: "/dashboard/academic/classes", label: "Kelas" },
    { href: "/dashboard/academic/subjects", label: "Mata pelajaran" },
  ],
  attendance: [{ href: "/dashboard/attendance", label: "Absensi" }],
  grades: [{ href: "/dashboard/grades", label: "Penilaian" }],
  finance: [{ href: "/dashboard/finance", label: "Keuangan" }],
  spmb: [{ href: "/dashboard/spmb", label: "SPMB" }],
  notifications: [{ href: "/dashboard/notifications", label: "Notifikasi WA" }],
  schools: [{ href: "/dashboard/schools", label: "Kelola Sekolah" }],
};

export function Sidebar({
  schoolName,
  userName,
  role,
  modules,
}: {
  schoolName: string;
  userName: string;
  role: UserRole;
  modules: string[];
}) {
  const pathname = usePathname();

  const links: NavItem[] = [{ href: "/dashboard", label: "Ringkasan" }];
  for (const m of modules) {
    if (MODULE_LINKS[m]) links.push(...MODULE_LINKS[m]);
  }

  return (
    <aside className="flex h-screen w-sidebar shrink-0 flex-col border-r border-chalk bg-white">
      {/* Identitas sekolah */}
      <div className="border-b border-chalk px-5 py-5">
        <p className="font-display text-lg leading-tight text-ink">
          {schoolName}
        </p>
        <p className="mt-0.5 text-xs text-slate">{roleLabel(role)}</p>
      </div>

      {/* Navigasi */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {links.map((l) => {
            const active =
              l.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cx(
                    "block rounded px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-board/10 font-medium text-board"
                      : "text-slate hover:bg-chalk/40 hover:text-ink",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Pengguna */}
      <div className="border-t border-chalk px-5 py-4">
        <p className="truncate text-sm font-medium text-ink">{userName}</p>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="mt-1 text-xs text-slate hover:text-marker"
          >
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}

export function roleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Admin",
    SCHOOL_ADMIN: "Admin Sekolah",
    PRINCIPAL: "Kepala Sekolah",
    TREASURER: "Bendahara",
    TEACHER: "Guru",
    STUDENT: "Siswa",
    PARENT: "Orang Tua",
    STAFF: "Staf",
  };
  return map[role];
}
