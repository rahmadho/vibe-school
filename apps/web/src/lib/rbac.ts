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
