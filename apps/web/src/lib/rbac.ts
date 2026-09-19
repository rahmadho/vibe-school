import type { UserRole } from "@prisma/client";

/**
 * ============================================================
 * RBAC — Role Based Access Control
 * ============================================================
 * Satu sumber kebenaran untuk "role X boleh apa".
 * Dipakai oleh middleware (route guard) DAN helper can() (per-aksi).
 */

export const ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TREASURER",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "STAFF",
  "CONTENT_EDITOR",
];

/** Modul aplikasi (sesuai PRD). */
export type Module =
  | "schools" // kelola daftar sekolah (super-admin)
  | "users"
  | "students"
  | "teachers"
  | "staff"
  | "academic" // tahun ajaran, kelas, mapel, jadwal
  | "attendance"
  | "grades"
  | "finance"
  | "spmb"
  | "content" // berita/pengumuman
  | "website" // tampilan web sekolah: blok, halaman, menu, tema
  | "notifications"
  | "audit"
  | "billing"; // langganan (super-admin)

export type Action = "read" | "create" | "update" | "delete" | "manage";

/** Ringkasan izin per role. "manage" mencakup semua aksi. */
const PERMISSIONS: Record<UserRole, Partial<Record<Module, Action[]>>> = {
  SUPER_ADMIN: {
    schools: ["manage"],
    users: ["manage"],
    students: ["manage"],
    teachers: ["manage"],
    staff: ["manage"],
    academic: ["manage"],
    attendance: ["manage"],
    grades: ["manage"],
    finance: ["manage"],
    spmb: ["manage"],
    content: ["manage"],
    website: ["manage"],
    notifications: ["manage"],
    audit: ["read"],
    billing: ["manage"],
  },
  SCHOOL_ADMIN: {
    users: ["manage"],
    students: ["manage"],
    teachers: ["manage"],
    staff: ["manage"],
    academic: ["manage"],
    attendance: ["manage"],
    grades: ["manage"],
    finance: ["manage"],
    spmb: ["manage"],
    content: ["manage"],
    website: ["manage"],
    notifications: ["manage"],
    audit: ["read"],
  },
  PRINCIPAL: {
    users: ["read"],
    students: ["read"],
    teachers: ["read"],
    staff: ["read"],
    academic: ["read"],
    attendance: ["read"],
    grades: ["read"],
    finance: ["read"], // lihat, tanpa edit
    spmb: ["read"],
    content: ["manage"],
    website: ["manage"],
    notifications: ["read"],
    audit: ["read"],
  },
  TREASURER: {
    students: ["read"],
    finance: ["manage"],
    spmb: ["read"],
    notifications: ["read"],
  },
  TEACHER: {
    students: ["read"],
    academic: ["read"],
    attendance: ["create", "update", "read"],
    grades: ["create", "update", "read"],
    content: ["read"],
    website: ["read"],
    notifications: ["read"],
  },
  /**
   * Editor Konten — guru/staf yang boleh menulis berita dan pengumuman.
   *
   * Sengaja TIDAK diberi akses siswa, nilai, absensi, maupun keuangan. Inilah
   * gunanya peran terpisah: operator TU sering bukan admin sistem, dan memberi
   * mereka akses penuh hanya agar bisa menulis berita adalah risiko yang tidak
   * perlu diambil.
   *
   * `website` hanya `read` — editor konten perlu melihat halaman web sekolah
   * untuk memeriksa tempat beritanya tampil, tetapi tidak boleh mengubah
   * susunan halaman atau tema.
   */
  CONTENT_EDITOR: {
    content: ["manage"],
    website: ["read"],
    notifications: ["read"],
  },
  STUDENT: {
    academic: ["read"],
    attendance: ["read"],
    grades: ["read"],
    finance: ["read"], // lihat tagihan sendiri
    content: ["read"],
  },
  PARENT: {
    academic: ["read"],
    attendance: ["read"],
    grades: ["read"],
    finance: ["read"],
    content: ["read"],
  },
  STAFF: {
    students: ["read", "create", "update"],
    teachers: ["read"],
    academic: ["read"],
    spmb: ["read", "update"],
    content: ["read"],
  },
};

/** Daftar seluruh modul (untuk keperluan tampilan & iterasi). */
export const ALL_MODULES: Module[] = [
  "schools",
  "users",
  "students",
  "teachers",
  "staff",
  "academic",
  "attendance",
  "grades",
  "finance",
  "spmb",
  "content",
  "website",
  "notifications",
  "audit",
  "billing",
];

/** Label bahasa Indonesia untuk modul (dipakai di UI). */
export const MODULE_LABEL: Record<Module, string> = {
  schools: "Kelola Sekolah",
  users: "Pengguna",
  students: "Siswa",
  teachers: "Guru & Staf",
  staff: "Staf",
  academic: "Akademik",
  attendance: "Absensi",
  grades: "Penilaian",
  finance: "Keuangan",
  spmb: "SPMB",
  content: "Berita & Pengumuman",
  website: "Web Sekolah",
  notifications: "Notifikasi WA",
  audit: "Log Aktivitas",
  billing: "Langganan",
};

/** Deskripsi singkat tiap role (ditampilkan di halaman detail pengguna). */
export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  SUPER_ADMIN: "Mengelola seluruh sekolah dalam sistem (lintas-tenant).",
  SCHOOL_ADMIN:
    "Administrator sekolah. Mengelola seluruh data akademik dan pengguna sekolah ini.",
  PRINCIPAL: "Kepala sekolah. Akses baca untuk sebagian besar modul.",
  TREASURER: "Bendahara. Mengelola keuangan, tagihan, dan pembayaran.",
  TEACHER: "Guru. Mengisi absensi dan nilai untuk kelas yang diampu.",
  STUDENT: "Siswa. Melihat jadwal, nilai, absensi, dan tagihan sendiri.",
  PARENT: "Orang tua/wali. Melihat perkembangan anak dan tagihan.",
  STAFF: "Staf administrasi. Membantu input data siswa dan SPMB.",
  CONTENT_EDITOR:
    "Editor konten. Menulis dan mengelola berita, pengumuman, agenda, serta galeri web sekolah.",
};

/**
 * Apakah role boleh melakukan aksi pada modul.
 * `manage` mencakup semua aksi lain.
 */
export function can(role: UserRole, module: Module, action: Action): boolean {
  const allowed = PERMISSIONS[role]?.[module];
  if (!allowed) return false;
  if (allowed.includes("manage")) return true;
  return allowed.includes(action);
}

/** Apakah role boleh mengakses modul (aksi apa pun). */
export function canAccessModule(role: UserRole, module: Module): boolean {
  return Boolean(PERMISSIONS[role]?.[module]?.length);
}

/** Modul yang boleh diakses role (untuk membangun menu sidebar). */
export function modulesFor(role: UserRole): Module[] {
  return (Object.keys(PERMISSIONS[role] ?? {}) as Module[]).filter((m) =>
    canAccessModule(role, m),
  );
}

/** Apakah role lintas-sekolah (boleh schoolId null). */
export function isCrossTenant(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}
