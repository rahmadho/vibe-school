import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listClasses, getAcademicYearOptions } from "@/lib/data/academic";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState } from "@/components/data-table";

export const metadata = { title: "Kelas" };

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const schoolId = session.user.schoolId;
  const sp = await searchParams;
  const years = await getAcademicYearOptions(schoolId);
  const activeYear = years.find((y) => y.isActive);

  // Jika parameter "academicYearId" bernilai "all", tampilkan semua.
  // Jika tidak diset, default ke tahun ajaran aktif.
  let academicYearId: string | undefined;
  if (sp.academicYearId === "all") {
    academicYearId = undefined;
  } else if (typeof sp.academicYearId === "string" && sp.academicYearId.length > 0) {
    academicYearId = sp.academicYearId;
  } else {
    academicYearId = activeYear?.id;
  }

  const classes = await listClasses(schoolId, { academicYearId });
  const canManage = can(session.user.role, "academic", "manage", session.user.permissions);
  const selectedYear = years.find((y) => y.id === academicYearId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelas"
        context={`${classes.length} kelas · ${selectedYear ? `Tahun ${selectedYear.name}` : "semua tahun ajaran"}`}
        actions={
          canManage && years.length > 0 ? (
            <div className="flex gap-2">
              <Link href="/dashboard/academic/progression">
                <Button variant="secondary">Kenaikan kelas</Button>
              </Link>
              <Link href="/dashboard/academic/classes/new">
                <Button>Tambah kelas</Button>
              </Link>
            </div>
          ) : null
        }
      />

      {years.length === 0 ? (
        <EmptyState
          title="Buat tahun ajaran dulu"
          description="Kelas selalu terikat pada satu tahun ajaran. Buat tahun ajaran terlebih dulu."
          action={
            <Link href="/dashboard/academic/years">
              <Button>Ke tahun ajaran</Button>
            </Link>
          }
        />
      ) : (
        <>
          <form
            className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
            action="/dashboard/academic/classes"
          >
            <div className="w-64">
              <label className="mb-1 block text-xs font-medium text-slate" htmlFor="academicYearId">
                Tahun ajaran
              </label>
              <select
                id="academicYearId"
                name="academicYearId"
                defaultValue={sp.academicYearId === "all" ? "all" : (academicYearId ?? "")}
                className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
              >
                <option value="all">Semua tahun ajaran</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                    {y.isActive ? " (aktif)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Terapkan</Button>
          </form>

          {classes.length === 0 ? (
            <EmptyState
              title="Belum ada kelas"
              description="Tambahkan kelas untuk tahun ajaran yang dipilih."
              action={
                canManage ? (
                  <Link href="/dashboard/academic/classes/new">
                    <Button>Tambah kelas</Button>
                  </Link>
                ) : null
              }
            />
          ) : (
            <Table
              head={
                <>
                  <th className="w-24">Kelas</th>
                  <th className="w-16">Tingkat</th>
                  <th className="w-44">Wali kelas</th>
                  <th className="w-24">Siswa</th>
                  <th className="w-56">Tahun ajaran</th>
                  <th className="w-24 text-right">Aksi</th>
                </>
              }
            >
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/dashboard/academic/classes/${c.id}`}
                      className="font-display text-lg text-ink hover:text-board tabular-display"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="tabular-nums text-slate">{c.level}</td>
                  <td className="text-slate">
                    {c.homeroomTeacher?.fullName ?? "—"}
                  </td>
                  <td className="tabular-nums text-slate">
                    {c._count.students}/{c.capacity}
                  </td>
                  <td className="text-slate">{c.academicYear.name}</td>
                  <td className="text-right">
                    <Link
                      href={`/dashboard/academic/classes/${c.id}`}
                      className="text-sm text-board hover:underline"
                    >
                      Lihat
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </div>
  );
}
