import "server-only";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * ============================================================
 * Pencarian user saat LOGIN — satu-satunya jalur lintas-tenant
 * ============================================================
 *
 * Saat login, sekolah pengguna belum diketahui. Itu justru yang sedang dicari.
 * Tapi `users` ikut RLS: view `app.users` hanya menampilkan baris yang
 * `schoolId`-nya sama dengan konteks sesi. Tanpa konteks, hasilnya NOL baris,
 * dan setiap percobaan masuk berakhir "email atau password salah" meski
 * kredensialnya benar.
 *
 * Penyelesaian: fungsi SECURITY DEFINER di database (`prisma/login-functions.sql`)
 * yang mengembalikan PERSIS satu baris berdasarkan kunci unik. Tidak ada
 * parameter limit, tidak ada pencarian bebas — jadi fungsi ini tidak bisa
 * dipakai untuk membaca daftar pengguna.
 *
 * Sengaja TIDAK memakai `prisma.user.*` biasa:
 *   - `findUnique` tanpa konteks → 0 baris (RLS)
 *   - membuka view users → mematikan isolasi tenant untuk seluruh aplikasi
 */

/** Kolom yang dibutuhkan pemeriksaan login. Bentuknya mengikuti USER_LOGIN_SELECT. */
type LoginUser = {
  id: string;
  schoolId: string | null;
  email: string | null;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  deletedAt: Date | null;
  mustChangePassword: boolean;
};

/** Cari user berdasarkan email (unik global). */
export async function findUserForLoginByEmail(
  email: string,
): Promise<LoginUser | null> {
  // Skema ditulis eksplisit: `search_path` role aplikasi adalah `data, public`,
  // dan tanpa kualifikasi PostgreSQL tidak menemukan fungsi ini.
  const rows = await prisma.$queryRaw<LoginUser[]>`
    SELECT * FROM public.app_login_user_by_email(${email})
  `;
  return rows[0] ?? null;
}

/** Cari user berdasarkan username/NIS DI DALAM satu sekolah (NIS tidak unik global). */
export async function findUserForLoginByUsername(
  username: string,
  schoolId: string,
): Promise<LoginUser | null> {
  const rows = await prisma.$queryRaw<LoginUser[]>`
    SELECT * FROM public.app_login_user_by_username(${username}, ${schoolId})
  `;
  return rows[0] ?? null;
}
