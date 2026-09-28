import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { getOverridesForRole } from "./data/permissions";
import { verifyImpersonateToken } from "./impersonate";

/**
 * ============================================================
 * NextAuth v5 (Auth.js) — konfigurasi
 * ============================================================
 * Sesi membawa: userId, role, schoolId. `schoolId` inilah yang dipakai
 * `scopedDb()` untuk mengunci query ke satu sekolah.
 *
 * PENTING: schoolId diambil dari DATABASE saat login, BUKAN dari input user.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      schoolId: string | null;
      /**
       * Penimpaan izin milik sekolah pengguna ini: `{ [module]: actions[] }`.
       *
       * Diambil dari database saat menyusun sesi, bukan disimpan di dalam
       * token JWT. Alasannya: token ikut dikirim di setiap permintaan dan
       * disimpan di cookie, sedangkan matriks izin bisa berubah kapan saja —
       * izin yang basi di token berarti operator masih bisa melakukan hal yang
       * baru saja dicabut. Objek ini juga bisa berisi puluhan modul.
       */
      permissions: Record<string, string[]>;
      /**
       * Bila sesi ini adalah hasil impersonasi Super Admin, berisi identitas
       * aktor aslinya. `null` untuk sesi biasa. Dipakai untuk menampilkan
       * spanduk "kembali ke akun Super Admin" dan menandai audit.
       */
      impersonatedBy: { id: string; name: string } | null;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    role: UserRole;
    schoolId: string | null;
    impersonatedBy?: { id: string; name: string } | null;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Wajib di produksi DI BALIK reverse proxy (Nginx/Cloudflare). NextAuth v5
  // hanya otomatis mempercayai host lokal; tanpa ini, host publik
  // (smpn1.sekolah.id) ditolak dan login gagal dengan
  // "There is a problem with the server configuration". Aman di sini karena
  // host sudah diverifikasi Nginx (proxy_set_header Host $host) dan hanya
  // host itulah yang dipakai untuk menentukan tenant.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Login butuh lintas-tenant (mencari user by email) → prisma mentah.
        // Ini SATU-SATUNYA query data user yang tidak lewat scopedDb, dan
        // aman karena tujuannya memang menemukan tenant si user.
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            schoolId: true,
            isActive: true,
            deletedAt: true,
          },
        });

        if (!user || !user.isActive || user.deletedAt) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        // Catat login terakhir (best-effort, jangan blok login bila gagal).
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch {
          /* abaikan */
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
        };
      },
    }),
    /**
     * Provider IMPERSONATE — "Masuk sebagai".
     *
     * Tidak menerima identitas mentah dari klien, melainkan TIKET bertanda
     * tangan yang dibuat server action setelah memverifikasi pemanggil
     * benar-benar SUPER_ADMIN (lihat `lib/impersonate.ts` untuk alasannya).
     *
     * Yang diperiksa di sini hanya: (1) tanda tangan tiket sah & belum
     * kedaluwarsa, (2) target ada, aktif, dan BUKAN super-admin. Aturan
     * terakhir penting — tanpa itu, impersonasi bisa dipakai untuk berpindah
     * antar sesama super-admin dan menghapus batas peran.
     */
    Credentials({
      id: "impersonate",
      name: "impersonate",
      credentials: { token: { label: "token", type: "text" } },
      async authorize(raw) {
        const token = typeof raw?.token === "string" ? raw.token : "";
        const payload = verifyImpersonateToken(token);
        if (!payload) return null;

        const target = await prisma.user.findUnique({
          where: { id: payload.targetUserId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            schoolId: true,
            isActive: true,
            deletedAt: true,
          },
        });

        // Target harus ada, aktif, dan bukan sesama super-admin.
        if (!target || !target.isActive || target.deletedAt) return null;
        if (target.role === "SUPER_ADMIN") return null;

        return {
          id: target.id,
          email: target.email,
          name: target.name,
          role: target.role,
          schoolId: target.schoolId,
          impersonatedBy: { id: payload.actorId, name: payload.actorName },
        };
      },
    }),
    /**
     * Provider KEMBALI — menukar sesi target kembali ke sesi Super Admin.
     *
     * Memakai mekanisme tiket yang sama, tetapi arahnya berlawanan (`to`
     * bernilai "restore"). Dipisahkan dari provider "impersonate" supaya tiket
     * masuk-tidak bisa dipakai untuk kembali, dan sebaliknya.
     *
     * Yang menjadi `id` sesi adalah aktor (super-admin). Karena aktor memang
     * role SUPER_ADMIN di database, tidak ada yang perlu dipalsukan — cukup
     * pastikan tiket sah, akun aktor masih aktif, dan ia benar-benar super-admin.
     */
    Credentials({
      id: "impersonate-return",
      name: "impersonate-return",
      credentials: { token: { label: "token", type: "text" } },
      async authorize(raw) {
        const token = typeof raw?.token === "string" ? raw.token : "";
        const payload = verifyImpersonateToken(token);
        if (!payload || payload.to !== "restore") return null;

        const actor = await prisma.user.findUnique({
          where: { id: payload.actorId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            schoolId: true,
            isActive: true,
            deletedAt: true,
          },
        });
        if (!actor || !actor.isActive || actor.deletedAt) return null;
        // Hanya super-admin yang boleh dipulihkan lewat jalur ini.
        if (actor.role !== "SUPER_ADMIN") return null;

        return {
          id: actor.id,
          email: actor.email,
          name: actor.name,
          role: actor.role,
          schoolId: actor.schoolId,
          // Sesi hasil pemulihan adalah sesi normal — tanpa penanda.
          impersonatedBy: null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.schoolId = user.schoolId;
        // Penanda impersonasi ikut di token agar bertahan lintas request.
        token.impersonatedBy = user.impersonatedBy ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as UserRole;
        session.user.schoolId = (token.schoolId as string | null) ?? null;
        session.user.impersonatedBy =
          (token.impersonatedBy as { id: string; name: string } | null) ?? null;

        // Izin diambil dari DATABASE pada setiap penyusunan sesi, bukan dari
        // token. Kalau disimpan di token, izin yang baru dicabut tetap berlaku
        // sampai pengguna login ulang — dan pencabutan izin biasanya justru
        // dilakukan karena ada masalah yang perlu segera berhenti.
        const role = token.role as UserRole;
        const schoolId = (token.schoolId as string | null) ?? null;
        session.user.permissions =
          schoolId && role !== "SUPER_ADMIN"
            ? await getOverridesForRole(schoolId, role)
            : {};
      }
      return session;
    },
  },
});

/**
 * Helper: ambil sesi + pastikan user punya schoolId (untuk data sekolah).
 * Melempar bila tidak ada sesi atau schoolId kosong.
 */
export async function requireSchoolSession() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  if (!session.user.schoolId) {
    throw new Error("NO_SCHOOL_SCOPE");
  }
  return {
    userId: session.user.id,
    role: session.user.role,
    schoolId: session.user.schoolId,
  };
}
