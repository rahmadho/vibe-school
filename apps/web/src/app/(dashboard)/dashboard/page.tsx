import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scopedDb } from "@/lib/scoped-db";
import { Stat } from "@/components/ui";
import { USER_ROLE_LABEL } from "@/lib/validations/user";

export const metadata = { title: "Ringkasan" };

/**
 * Dashboard ringkasan — Fase 1 masih placeholder, tetapi menampilkan angka
 * NYATA dari database: membuktikan scopedDb mengisolasi per sekolah.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, schoolId, name } = session.user;

  // Super-admin lintas-sekolah: tampilkan ringkas jumlah sekolah.
  if (!schoolId) {
    const [schools, students] = await Promise.all([
      prisma.school.count({ where: { deletedAt: null } }),
      prisma.student.count({ where: { deletedAt: null } }),
    ]);
    return (
      <div>
        <h1 className="font-display text-3xl text-ink">Ringkasan</h1>
        <p className="mt-1 text-slate">Selamat datang, {name}.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat value={schools} label="Sekolah terdaftar" />
          <Stat value={students} label="Total siswa" hint="semua sekolah" />
          <Stat value="∞" label="Akses lintas sekolah" hint={USER_ROLE_LABEL[role]} />
        </div>
      </div>
    );
  }

  // User sekolah: SEMUA query lewat scopedDb → hanya data sekolah ini.
  const db = scopedDb(schoolId);
  const [students, teachers, classes, unpaid] = await Promise.all([
    db.student.count(),
    db.teacher.count(),
    db.class.count(),
    db.invoice.count({ where: { status: "UNPAID" } }),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Ringkasan</h1>
      <p className="mt-1 text-slate">
        Selamat datang, {name} · {USER_ROLE_LABEL[role]}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={students} label="Siswa aktif" />
        <Stat value={teachers} label="Guru" />
        <Stat value={classes} label="Kelas" />
        <Stat
          value={unpaid}
          label="Tagihan belum lunas"
          hint="status UNPAID"
        />
      </div>

      <div className="card mt-8">
        <h2 className="card-title">Fase 1 selesai</h2>
        <p className="mt-2 max-w-prose text-sm text-slate">
          Kerangka multi-tenant aktif: autentikasi, RBAC, dan isolasi data per
          sekolah sudah berjalan. Angka di atas diambil lewat{" "}
          <code className="rounded bg-chalk/50 px-1 py-0.5 text-xs">
            scopedDb(schoolId)
          </code>{" "}
          sehingga tidak mungkin menampilkan siswa dari sekolah lain.
        </p>
      </div>
    </div>
  );
}
