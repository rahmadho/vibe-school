"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { UserRole } from "@prisma/client";
import { USER_ROLE_LABEL } from "@/lib/validations/user";
import { cx } from "./ui";

/**
 * Sidebar — navigasi per-role, berkelompok.
 *
 * ============================================================
 * KENAPA BERKELOMPOK
 * ============================================================
 * Sebelumnya seluruh tautan mengalir dalam satu kolom: "Ringkasan, Pengguna,
 * Siswa, Guru, Staf, Akademik, Jadwal, Jam Pelajaran, Absensi, Rekap Absensi,
 * Penilaian, …" — lebih dari tiga puluh baris tanpa satu pun tanda batas.
 * Akibatnya operator harus MEMBACA setiap baris untuk menemukan satu tujuan,
 * dan tidak ada yang memberi tahu bahwa "Tagihan" dan "Tunggakan" itu satu
 * urusan sedangkan "Absensi" urusan lain.
 *
 * Sekarang tiap kelompok punya label kecil huruf kapital dengan garis tipis —
 * seperti kepala kolom di buku induk sekolah. Mata cukup melompat ke kelompok,
 * lalu ke barisnya.
 *
 * ============================================================
 * IKON: SVG SEBARIS, BUKAN EMOJI, BUKAN PUSTAKA
 * ============================================================
 *  - Emoji tampil berbeda di tiap sistem operasi (dan berwarna), sehingga
 *    merusak ketenangan arah "papan tulis & arsip sekolah".
 *  - Pustaka ikon berarti satu dependensi baru hanya untuk ~30 gambar.
 *    Digambar sebaris sebagai data `d` — cukup, dan bisa diwarnai `currentColor`
 *    sehingga ikut berubah saat baris aktif atau disorot.
 *
 * ============================================================
 * HIRARKI: GARIS, BUKAN KOTAK
 * ============================================================
 * Status aktif ditandai garis hijau papan tulis di tepi kiri + teks berwarna,
 * BUKAN pil berlatar penuh. Alasannya ada di README: hierarki di sistem ini
 * dibangun lewat border dan ruang, bukan shadow maupun blok warna. Hijau
 * papan tulis juga sengaja langka — kalau setiap baris bisa hijau, tidak ada
 * yang menonjol.
 */

/* ============================================================
 * IKON
 * ============================================================ */

/**
 * Data gambar ikon (viewBox 24×24, garis 1.6, ujung membulat).
 * Beberapa baris sengaja berbagi gambar karena memang satu urusan.
 */
const ICON_PATHS: Record<string, string> = {
  // Ringkasan
  home: "M3.5 10.6 12 3.6l8.5 7M5.8 9.2V20h12.4V9.2M10 20v-5.5h4V20",
  // Kesiswaan
  students:
    "M3 9.4 12 5l9 4.4-9 4.4zM7.2 11.6V16c0 1.6 2.1 2.9 4.8 2.9s4.8-1.3 4.8-2.9v-4.4",
  teachers: "M3.5 4.5h17v11h-17zM7.5 20l4.5-4 4.5 4",
  staff:
    "M3.5 8h17v11h-17zM9 8V6.2A1.2 1.2 0 0 1 10.2 5h3.6A1.2 1.2 0 0 1 15 6.2V8M3.5 12.4h17",
  users:
    "M15.5 19.5v-1.4a3.6 3.6 0 0 0-3.6-3.6H7.6A3.6 3.6 0 0 0 4 18.1v1.4M13.5 8.2a3.6 3.6 0 1 1-7.2 0 3.6 3.6 0 0 1 7.2 0M20 19.5v-1.4a3.6 3.6 0 0 0-2.7-3.5M15 5.1a3.6 3.6 0 0 1 0 6.2",
  schools: "M4 20.5V9.2L12 4l8 5.2v11.3M9.2 20.5V14h5.6v6.5M4 20.5h16",
  spmb:
    "M9.2 4.2h5.6v3H9.2zM9.2 5.7H7a2 2 0 0 0-2 2v10.6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.7a2 2 0 0 0-2-2h-2.2M8.8 11h6.4M8.8 14.4h4.4",
  // Akademik
  academic:
    "M4.2 5.6A2.6 2.6 0 0 1 6.8 3H19v14.4H6.8a2.6 2.6 0 0 0-2.6 2.6zM4.2 20a2.6 2.6 0 0 1 2.6-2.6H19V20H6.8",
  calendar: "M3.8 5.8h16.4v14.4H3.8zM3.8 10.4h16.4M8.2 3.4v4.2M15.8 3.4v4.2",
  schedule: "M3.8 5.8h16.4v14.4H3.8zM3.8 10.4h16.4M9 10.4v9.8M15 10.4v9.8",
  timeslot: "M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2zM12 7.4V12l3.2 2",
  attendance: "M3.8 3.8h16.4v16.4H3.8zM8 12.2l2.8 2.8 5.2-6",
  summary: "M4 20.2V13M10 20.2V5.4M16 20.2v-5M20 20.2H3",
  grades: "m4 20.2 1-4.2L16 5l3.2 3.2L8.2 19.2zM14.2 6.8 17.4 10",
  gradeitems: "M4 7.4h16M4 12h16M4 16.6h16M9.4 5v4.8M15 9.6v4.8M11.6 14.2v4.8",
  report:
    "M13.6 3.4H7.4a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8.4zM13.6 3.4v5h5M8.8 13h6.4M8.8 16.4h4.4",
  // Keuangan
  finance:
    "M3.6 8.2A2.6 2.6 0 0 1 6.2 5.6h11.6a2 2 0 0 1 2 2v10.8a2 2 0 0 1-2 2H6.2a2.6 2.6 0 0 1-2.6-2.6zM3.6 8.2v8.4M15.8 12h2.6",
  invoices: "M6.2 3.4h11.6v17.2l-2.9-1.9-2.9 1.9-2.9-1.9-2.9 1.9zM9.2 8.4h5.6M9.2 12.2h5.6",
  overdue: "M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2zM12 7.8v4.6M12 16.4h.02",
  feetypes: "M3.6 11.4V5.6a2 2 0 0 1 2-2h5.8l9 9-7.8 7.8zM8 8h.02",
  methods: "M2.8 5.8h18.4v12.4H2.8zM2.8 10.4h18.4M6.4 15h2.4",
  gateway:
    "M10.2 13.4a4.6 4.6 0 0 0 6.6 0l2.2-2.2a4.6 4.6 0 0 0-6.6-6.6l-1 1M13.8 10.6a4.6 4.6 0 0 0-6.6 0L5 12.8a4.6 4.6 0 0 0 6.6 6.6l1-1",
  // Komunikasi
  notifications:
    "M20.4 12a8 8 0 0 1-8 8H7.6L4 22.8V12a8 8 0 0 1 8-8h.4a8 8 0 0 1 8 8z",
  whatsapp:
    "M5 4.4h3.8l1.9 4.8-2.4 1.4a11 11 0 0 0 4.7 4.7l1.4-2.4 4.8 1.9v3.8a1 1 0 0 1-1 1A15.6 15.6 0 0 1 4 5.4a1 1 0 0 1 1-1z",
  queue: "m21.6 2.8-6.8 19-3.8-8.4-8.4-3.8zM21.6 2.8 11 13.4",
  templates:
    "M13.6 3.4H7.4a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8.4zM13.6 3.4v5h5M8.8 13h6.4M8.8 16.4h4.4",
  announcements: "M3.4 11.2v1.6a1 1 0 0 0 1 1h1.8l4.2 4.2V6L6.2 10.2H4.4a1 1 0 0 0-1 1zM14.6 8.4a5 5 0 0 1 0 7.2",
  // Web sekolah
  website:
    "M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2zM3.6 12h16.8M12 3.4a13 13 0 0 1 0 17.2M12 3.4a13 13 0 0 0 0 17.2",
  content:
    "M4 5.6h11.6a2 2 0 0 1 2 2v12.8H6a2 2 0 0 1-2-2zM17.6 19.4h1.4a2 2 0 0 0 2-2V9.4M8 9.4h5.6M8 12.8h5.6M8 16.2h3.2",
  theme:
    "M12 3.4a8.6 8.6 0 0 0 0 17.2c1 0 1.6-.7 1.6-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.8.7-1.5 1.5-1.5h1.6a5 5 0 0 0 5-5c0-4.3-3.9-7-8.7-7zM7.8 11.6h.02M10.4 8h.02M14.4 7.6h.02",
  pages: "M4 5.6h10.4v13.8H4zM17.2 5.6H20v13.8h-2.8M7 9.4h4.4M7 12.6h4.4",
  menu: "m12 3.4 8.6 4.8-8.6 4.8-8.6-4.8zM3.4 13.2l8.6 4.8 8.6-4.8",
  identity:
    "M12 15.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM16.4 12v1.6a2.4 2.4 0 0 0 4.8 0V12a9.2 9.2 0 1 0-3.6 7.3",
  // Sistem
  audit: "M3.4 12a8.6 8.6 0 1 0 2.9-6.4M3.4 4.6v4.6h4.6M12 8v4.4l3.2 2",
  billing:
    "m12 3.4 2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.9z",
};

/** Ukuran ikon: 15px — cukup dikenali, tidak sampai bersaing dengan label. */
function Icon({ name }: { name: string }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-[3px] shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

/* ============================================================
 * MODEL NAVIGASI
 * ============================================================ */

type NavEntry = {
  href: string;
  label: string;
  icon: string;
  /** Modul RBAC yang menguasai tautan ini (lihat lib/rbac.ts). */
  module: string;
};

type NavGroup = {
  /** Judul kelompok. Kosong = tanpa judul (dipakai untuk Ringkasan). */
  label: string;
  entries: NavEntry[];
};

/**
 * Susunan menu.
 *
 * URUTAN KELOMPOK mengikuti kekerapan pemakaian, bukan urutan modul di kode:
 * data pokok lebih dulu karena hampir setiap sesi menyentuhnya, lalu akademik
 * (keseharian), keuangan (akhir bulan), komunikasi, web sekolah, dan sistem.
 *
 * CATATAN: hanya halaman yang BENAR-BENAR ada yang didaftarkan di sini. Tautan
 * mati lebih membingungkan daripada tautan yang tidak ada — operator mengira
 * aplikasinya rusak, bukan bahwa fiturnya belum dibuat.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    entries: [{ href: "/dashboard", label: "Ringkasan", icon: "home", module: "students" }],
  },
  {
    label: "Data Pokok",
    entries: [
      { href: "/dashboard/students", label: "Siswa", icon: "students", module: "students" },
      { href: "/dashboard/teachers", label: "Guru", icon: "teachers", module: "teachers" },
      { href: "/dashboard/staff", label: "Staf", icon: "staff", module: "staff" },
      { href: "/dashboard/users", label: "Pengguna", icon: "users", module: "users" },
      { href: "/dashboard/spmb", label: "SPMB", icon: "spmb", module: "spmb" },
      { href: "/dashboard/spmb/registrations", label: "Pendaftar SPMB", icon: "students", module: "spmb" },
    ],
  },
  {
    label: "Akademik",
    entries: [
      { href: "/dashboard/academic", label: "Akademik", icon: "academic", module: "academic" },
      { href: "/dashboard/academic/progression", label: "Kenaikan Kelas", icon: "summary", module: "academic" },
      { href: "/dashboard/academic/schedules", label: "Jadwal", icon: "schedule", module: "academic" },
      { href: "/dashboard/academic/time-slots", label: "Jam Pelajaran", icon: "timeslot", module: "academic" },
      { href: "/dashboard/attendance", label: "Absensi", icon: "attendance", module: "attendance" },
      { href: "/dashboard/attendance/summary", label: "Rekap Absensi", icon: "summary", module: "attendance" },
      { href: "/dashboard/grades", label: "Penilaian", icon: "grades", module: "grades" },
      { href: "/dashboard/grades/report", label: "Rekap & Rapor", icon: "report", module: "grades" },
      { href: "/dashboard/grades/items", label: "Komponen Nilai", icon: "gradeitems", module: "grades" },
    ],
  },
  {
    label: "Keuangan",
    entries: [
      { href: "/dashboard/finance", label: "Keuangan", icon: "finance", module: "finance" },
      { href: "/dashboard/finance/invoices", label: "Tagihan", icon: "invoices", module: "finance" },
      { href: "/dashboard/finance/overdue", label: "Tunggakan", icon: "overdue", module: "finance" },
      { href: "/dashboard/finance/fees", label: "Jenis Biaya", icon: "feetypes", module: "finance" },
      { href: "/dashboard/finance/methods", label: "Metode Bayar", icon: "methods", module: "finance" },
      { href: "/dashboard/finance/gateway", label: "Gateway", icon: "gateway", module: "finance" },
    ],
  },
  {
    label: "Komunikasi",
    entries: [
      { href: "/dashboard/notifications", label: "Notifikasi WA", icon: "notifications", module: "notifications" },
      { href: "/dashboard/notifications/whatsapp", label: "Koneksi WhatsApp", icon: "whatsapp", module: "notifications" },
      { href: "/dashboard/notifications/queue", label: "Antrean Kirim", icon: "queue", module: "notifications" },
      { href: "/dashboard/notifications/templates", label: "Template Pesan", icon: "templates", module: "notifications" },
      { href: "/dashboard/notifications/announcements", label: "Pengumuman", icon: "announcements", module: "notifications" },
    ],
  },
  {
    label: "Web Sekolah",
    entries: [
      { href: "/dashboard/website", label: "Web Sekolah", icon: "website", module: "website" },
      { href: "/dashboard/content", label: "Berita & Pengumuman", icon: "content", module: "content" },
      { href: "/dashboard/website/theme", label: "Tema & Warna", icon: "theme", module: "website" },
      { href: "/dashboard/website/pages", label: "Halaman", icon: "pages", module: "website" },
      { href: "/dashboard/website/navigation", label: "Menu", icon: "menu", module: "website" },
      { href: "/dashboard/website/settings", label: "Identitas & Kontak", icon: "identity", module: "website" },
    ],
  },
  {
    label: "Sistem",
    entries: [
      { href: "/dashboard/schools", label: "Kelola Sekolah", icon: "schools", module: "schools" },
      { href: "/dashboard/audit", label: "Log Aktivitas", icon: "audit", module: "audit" },
      { href: "/dashboard/billing", label: "Langganan", icon: "billing", module: "billing" },
    ],
  },
];

/* ============================================================
 * KOMPONEN
 * ============================================================ */

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

  // Saring per izin role, lalu buang kelompok yang jadi kosong. Tanpa ini,
  // bendahara melihat judul "Akademik" menggantung tanpa isi.
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    entries: g.entries.filter((e) => modules.includes(e.module)),
  })).filter((g) => g.entries.length > 0);

  const allEntries = groups.flatMap((g) => g.entries);

  /**
   * Satu tujuan saja yang boleh tampak aktif.
   *
   * Pencocokan memakai awalan, sehingga "/dashboard/spmb" ikut cocok saat
   * pengunjung berada di "/dashboard/spmb/registrations" — dua baris menyala
   * sekaligus. Karena itu diambil kandidat dengan awalan TERPANJANG: yang
   * paling spesifik menang.
   */
  const activeHref = allEntries
    .filter((e) =>
      e.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(e.href),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="flex h-screen w-sidebar shrink-0 flex-col border-r border-chalk bg-white">
      {/* Identitas sekolah */}
      <div className="border-b border-chalk px-5 py-5">
        <p className="font-display text-lg leading-tight text-ink">{schoolName}</p>
        <p className="mt-0.5 text-xs text-slate">{USER_ROLE_LABEL[role]}</p>
      </div>

      {/* Navigasi */}
      <nav className="flex-1 overflow-y-auto px-3 pb-6 pt-4" aria-label="Navigasi utama">
        {groups.map((group, gi) => (
          <div key={group.label || "utama"} className={gi === 0 ? "" : "mt-5"}>
            {group.label ? (
              // Kepala kelompok: huruf kapital kecil, jarak antarhuruf lebar —
              // seperti kepala kolom di buku induk, bukan judul yang berteriak.
              <p className="mb-1.5 flex items-center gap-2 px-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-light">
                  {group.label}
                </span>
                <span aria-hidden className="h-px flex-1 bg-chalk" />
              </p>
            ) : null}

            <ul className="space-y-0.5">
              {group.entries.map((entry) => {
                const active = entry.href === activeHref;
                return (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "relative flex items-start gap-2.5 rounded-sm py-1.5 pl-3 pr-2 text-[13px] leading-5 transition-colors",
                        active
                          ? "bg-board/[0.07] font-medium text-board"
                          : "text-slate hover:bg-chalk/40 hover:text-ink",
                      )}
                    >
                      {/* Garis penanda aktif — hierarki lewat border, bukan pil. */}
                      <span
                        aria-hidden
                        className={cx(
                          "absolute inset-y-1 left-0 w-[2px] rounded-full",
                          active ? "bg-board" : "bg-transparent",
                        )}
                      />
                      <Icon name={entry.icon} />
                      <span className="min-w-0">{entry.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pengguna */}
      <div className="border-t border-chalk px-5 py-4">
        <p className="truncate text-sm font-medium text-ink">{userName}</p>
        <button
          type="button"
          onClick={() => signOut({ redirectTo: "/login" })}
          className="mt-1 text-xs text-slate hover:text-marker"
        >
          Keluar
        </button>
      </div>
    </aside>
  );
}
