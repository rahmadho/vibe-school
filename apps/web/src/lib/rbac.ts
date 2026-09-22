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
    // `billing` HANYA baca: admin sekolah perlu tahu paket & sisa kuotanya,
    // tetapi mengubah langganan menyentuh penagihan ke yayasan — itu alur
    // tersendiri (super-admin / penyedia layanan), bukan tombol di dasbor
    // sekolah. Tanpa baris ini, menu "Langganan" tidak muncul dan halamannya
    // menolak admin sekolah yang justru pemakainya.
    billing: ["read"],
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
    billing: ["read"],
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
 * Penimpaan izin satu sekolah: `{ [module]: actions[] }`.
 *
 * Hanya berisi modul yang SENGAJA diubah sekolah. Modul yang tidak ada di sini
 * memakai matriks bawaan di atas — itulah sebabnya sekolah yang belum pernah
 * membuka halaman Izin berperilaku persis seperti sebelumnya.
 */
export type PermissionOverride = Partial<Record<Module, Action[]>>;

/** Semua aksi yang dikenal, dipakai UI matriks. */
export const ALL_ACTIONS: Action[] = ["read", "create", "update", "delete", "manage"];

/**
 * Apakah role boleh melakukan aksi pada modul.
 * `manage` mencakup semua aksi lain.
 *
 * `override` (opsional) adalah penimpaan milik sekolah. Bila modul itu ada di
 * dalamnya, penimpaan MENGGANTIKAN bawaan sepenuhnya — bukan menambah.
 * Dua alasan:
 *   1. "Mencabut izin" harus mungkin. Kalau penimpaan hanya menambah, tidak
 *      ada cara membuat bendahara berhenti boleh mengubah tagihan.
 *   2. Perilakunya mudah ditebak: yang terlihat di layar itulah yang berlaku.
 *      Menambah-diam-diam membuat operator tidak pernah yakin apakah sebuah
 *      centang benar-benar mencabut atau tidak.
 */
export function can(
  role: UserRole,
  module: Module,
  action: Action,
  override?: PermissionOverride | null,
): boolean {
  // SUPER_ADMIN sengaja TIDAK bisa ditimpa: ia pengelola lintas sekolah, dan
  // sekolah tidak boleh mengunci dirinya sendiri dari pemulihan.
  if (role !== "SUPER_ADMIN" && override && Object.hasOwn(override, module)) {
    const allowed = override[module] ?? [];
    if (allowed.includes("manage")) return true;
    return allowed.includes(action);
  }

  const allowed = PERMISSIONS[role]?.[module];
  if (!allowed) return false;
  if (allowed.includes("manage")) return true;
  return allowed.includes(action);
}

/** Apakah role boleh mengakses modul (aksi apa pun). */
export function canAccessModule(
  role: UserRole,
  module: Module,
  override?: PermissionOverride | null,
): boolean {
  if (role !== "SUPER_ADMIN" && override && Object.hasOwn(override, module)) {
    return (override[module] ?? []).length > 0;
  }
  return Boolean(PERMISSIONS[role]?.[module]?.length);
}

/**
 * Modul yang boleh diakses role (untuk membangun menu sidebar).
 *
 * Penimpaan bisa MENCABUT modul maupun MEMBERI modul yang tidak ada di bawaan,
 * jadi hasilnya adalah gabungan kunci bawaan dan kunci penimpaan.
 */
export function modulesFor(
  role: UserRole,
  override?: PermissionOverride | null,
): Module[] {
  const keys = new Set<Module>(Object.keys(PERMISSIONS[role] ?? {}) as Module[]);
  if (role !== "SUPER_ADMIN" && override) {
    for (const m of Object.keys(override) as Module[]) keys.add(m);
  }
  return Array.from(keys).filter((m) => canAccessModule(role, m, override));
}

/** Apakah role lintas-sekolah (boleh schoolId null). */
export function isCrossTenant(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

/**
 * Matriks izin EFEKTIF untuk satu role di satu sekolah — dipakai halaman
 * pengaturan izin untuk menampilkan keadaan sebenarnya, bukan bawaan saja.
 *
 * Modul yang ditimpa ditampilkan dengan nilainya; sisanya memakai bawaan.
 */
export function effectivePermissions(
  role: UserRole,
  override?: PermissionOverride | null,
): Record<Module, Action[]> {
  const out = {} as Record<Module, Action[]>;
  for (const m of ALL_MODULES) {
    if (role !== "SUPER_ADMIN" && override && Object.hasOwn(override, m)) {
      out[m] = [...(override[m] ?? [])];
    } else {
      out[m] = [...(PERMISSIONS[role]?.[m] ?? [])];
    }
  }
  return out;
}

/** Apakah modul ini sedang ditimpa (berbeda dari bawaan)? */
export function isOverridden(
  role: UserRole,
  module: Module,
  override?: PermissionOverride | null,
): boolean {
  return Boolean(role !== "SUPER_ADMIN" && override && Object.hasOwn(override, module));
}

/**
 * Apakah masih ADA role yang boleh mengelola pengguna?
 *
 * ============================================================
 * KENAPA PEMERIKSAAN INI ADA
 * ============================================================
 * Halaman Hak Akses sendiri dibuka dengan izin `users: manage`. Kalau operator
 * mencabut izin itu dari SEMUA role yang bisa ia atur, tidak ada seorang pun di
 * sekolah yang bisa membukanya lagi — termasuk orang yang baru saja
 * melakukannya. Pemulihannya harus lewat Super Admin, yaitu jalur luar yang
 * tidak seharusnya dibutuhkan hanya karena salah mencentang.
 *
 * Karena itu perubahan yang menghasilkan keadaan itu DITOLAK, bukan
 * diperingatkan. Peringatan mudah dilewati; penguncian permanen tidak.
 *
 * `SUPER_ADMIN` tidak ikut dihitung: ia pengelola platform, bukan pengguna
 * sekolah, dan tidak bisa dipakai sekolah untuk membuka dirinya sendiri.
 */
export function anyRoleCanManageUsers(
  roles: readonly UserRole[],
  overrides: Record<string, PermissionOverride | null | undefined>,
): boolean {
  return roles.some((role) => can(role, "users", "manage", overrides[role]));
}

/** Izin bawaan satu role pada satu modul — untuk menampilkan "semula". */
export function defaultActionsFor(role: UserRole, module: Module): Action[] {
  return [...(PERMISSIONS[role]?.[module] ?? [])];
}
