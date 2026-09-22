import Link from "next/link";
import { guard } from "@/lib/action-guard";
import {
  ALL_MODULES,
  MODULE_LABEL,
  effectivePermissions,
  type Action,
  type Module,
} from "@/lib/rbac";
import type { UserRole } from "@prisma/client";
import { listRolePermissions } from "@/lib/data/permissions";
import { SCHOOL_MANAGEABLE_ROLES } from "@/lib/validations/user";
import { USER_ROLE_LABEL } from "@/lib/validations/user";
import { PermissionMatrix } from "./permission-matrix";

export const metadata = { title: "Hak Akses" };
export const dynamic = "force-dynamic";

/**
 * Halaman pengaturan hak akses.
 *
 * ============================================================
 * MODUL YANG DISEMBUNYIKAN
 * ============================================================
 * `schools` dan `billing` tidak ditampilkan: keduanya urusan lintas-sekolah
 * atau penagihan ke yayasan, dan bukan sesuatu yang boleh diatur sekolah untuk
 * dirinya sendiri. Menampilkannya hanya mengundang operator menyalakan akses
 * yang tidak akan berpengaruh apa pun.
 */
const HIDDEN_MODULES: Module[] = ["schools", "billing"];

export default async function PermissionsPage() {
  const g = await guard("users", "manage");
  if ("fail" in g) {
    return (
      <div className="mx-auto max-w-md border-2 border-[var(--chalk)] bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">
          Tidak dapat diakses
        </p>
        <p className="mt-2 text-sm text-[var(--slate)]">
          {g.fail.ok ? "Hanya admin sekolah yang dapat mengatur hak akses." : g.fail.error}
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm underline">
          ← Kembali ke dasbor
        </Link>
      </div>
    );
  }

  const { schoolId } = g.ctx;

  const modules = ALL_MODULES.filter((m) => !HIDDEN_MODULES.includes(m));
  const roles = SCHOOL_MANAGEABLE_ROLES.map((role) => ({
    role: role as string,
    label: USER_ROLE_LABEL[role],
  }));

  const rows = await listRolePermissions(schoolId);

  // Bentuk penimpaan menjadi map siap pakai.
  const overrides: Record<string, Record<string, Action[]>> = {};
  for (const r of rows) {
    (overrides[r.role] ??= {})[r.module] = r.actions as Action[];
  }

  // Matriks bawaan diambil dari kode — dipakai untuk menampilkan "bawaan: …"
  // pada baris yang sudah diubah, dan untuk tombol kembali ke bawaan.
  const defaults: Record<string, Record<string, Action[]>> = {};
  for (const { role } of roles) {
    const eff = effectivePermissions(role as UserRole, null);
    const perModule: Record<string, Action[]> = {};
    for (const m of modules) perModule[m] = eff[m];
    defaults[role] = perModule;
  }

  const overriddenCount = rows.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="border-b-2 border-[var(--ink)] pb-4">
        <p className="text-sm text-[var(--slate)]">
          <Link href="/dashboard" className="underline">
            Dasbor
          </Link>{" "}
          / Hak Akses
        </p>
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
          Hak Akses
        </h1>
        <p className="mt-1 max-w-prose text-sm text-[var(--slate)]">
          Atur apa yang boleh dilakukan tiap peran di sekolah ini. Perubahan
          berlaku untuk semua pengguna dengan peran tersebut, dan langsung
          terpakai pada permintaan berikutnya.
        </p>
        {overriddenCount > 0 ? (
          <p className="mt-2 text-xs text-[var(--marker)]">
            {overriddenCount} pengaturan berbeda dari bawaan.
          </p>
        ) : null}
      </header>

      <section className="border-l-4 border-[var(--chalk)] bg-[var(--paper)] px-4 py-3">
        <p className="text-sm text-[var(--ink)]">
          <strong>Kelola (K)</strong> mencakup semua aksi lain — menyalakannya
          berarti peran itu boleh melihat, menambah, mengubah, dan menghapus
          pada modul tersebut. Modul yang tidak diubah akan mengikuti
          pengaturan bawaan aplikasi.
        </p>
        <p className="mt-1.5 text-xs text-[var(--slate)]">
          Peran <strong>Super Admin</strong> sengaja tidak dapat diubah: ia
          pengelola lintas sekolah, dan sekolah tidak boleh mengunci dirinya
          sendiri dari jalur pemulihan.
        </p>
      </section>

      <PermissionMatrix
        roles={roles}
        modules={modules}
        defaults={defaults}
        overrides={overrides}
      />

      <section className="border-t border-[var(--chalk)] pt-4">
        <h2 className="text-sm font-medium text-[var(--ink)]">Catatan</h2>
        <ul className="mt-2 space-y-1 text-xs text-[var(--slate)]">
          <li>
            Menyembunyikan modul dari peran juga menyembunyikan menunya di
            sidebar — dan aksinya tetap ditolak walaupun alamatnya dibuka
            langsung.
          </li>
          <li>
            Izin dibaca ulang setiap permintaan, jadi perubahan berlaku segera
            tanpa perlu pengguna login ulang.
          </li>
          <li>
            Peran yang dipakai sendiri oleh admin sekolah tetap dapat diubah,
            tetapi berhati-hatilah: mencabut akses{" "}
            <span className="font-mono">Pengguna</span> akan membuat halaman ini
            tidak bisa dibuka lagi.
          </li>
        </ul>
      </section>
    </div>
  );
}
