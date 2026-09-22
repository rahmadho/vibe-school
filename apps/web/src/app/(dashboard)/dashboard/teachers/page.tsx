import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTeachers, getTeacherStats } from "@/lib/data/personnel";
import { teacherFilterSchema } from "@/lib/validations/personnel";
import { GENDER_LABEL } from "@/lib/validations/personnel";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState, Pagination } from "@/components/data-table";

export const metadata = { title: "Guru" };

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const schoolId = session.user.schoolId;
  const sp = await searchParams;
  const filter = teacherFilterSchema.parse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    active: typeof sp.active === "string" ? sp.active : undefined,
    page: sp.page ?? 1,
    perPage: sp.perPage ?? 20,
  });

  const [result, stats] = await Promise.all([
    listTeachers(schoolId, filter),
    getTeacherStats(schoolId),
  ]);

  const canManage = can(session.user.role, "teachers", "manage", session.user.permissions);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guru"
        context={`${stats.total} guru · ${stats.active} aktif · ${stats.male} L / ${stats.female} P`}
        actions={
          canManage ? (
            <Link href="/dashboard/teachers/new">
              <Button>Tambah guru</Button>
            </Link>
          ) : null
        }
      />

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
        action="/dashboard/teachers"
      >
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate">
            Cari
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="Nama atau NIP"
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          />
        </div>
        <div className="w-40">
          <label
            htmlFor="active"
            className="mb-1 block text-xs font-medium text-slate"
          >
            Status
          </label>
          <select
            id="active"
            name="active"
            defaultValue={filter.active ?? ""}
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          >
            <option value="">Semua</option>
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </select>
        </div>
        <Button type="submit">Terapkan</Button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title="Belum ada guru"
          description="Tambahkan data guru agar bisa menyusun jadwal, jadwal mengajar, dan wali kelas."
          action={
            canManage ? (
              <Link href="/dashboard/teachers/new">
                <Button>Tambah guru</Button>
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <Table
            head={
              <>
                <th className="w-32">NIP</th>
                <th>Nama</th>
                <th className="w-24">Gender</th>
                <th className="w-28">Mapel</th>
                <th className="w-24">Wali kelas</th>
                <th className="w-24 text-right">Aksi</th>
              </>
            }
          >
            {result.items.map((t) => (
              <tr key={t.id}>
                <td className="font-mono text-xs tabular-nums text-slate">
                  {t.nip ?? "—"}
                </td>
                <td>
                  <Link
                    href={`/dashboard/teachers/${t.id}`}
                    className="font-medium text-ink hover:text-board"
                  >
                    {t.fullName}
                  </Link>
                  {!t.isActive ? (
                    <span className="ml-2 text-xs text-slate">(nonaktif)</span>
                  ) : null}
                </td>
                <td className="text-slate">{GENDER_LABEL[t.gender]}</td>
                <td className="tabular-nums text-slate">{t._count.subjects}</td>
                <td className="tabular-nums text-slate">
                  {t._count.homeroomOf}
                </td>
                <td className="text-right">
                  <Link
                    href={`/dashboard/teachers/${t.id}`}
                    className="text-sm text-board hover:underline"
                  >
                    Lihat
                  </Link>
                </td>
              </tr>
            ))}
          </Table>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/dashboard/teachers"
            params={{
              q: filter.q,
              active: filter.active,
              perPage: String(filter.perPage),
            }}
          />
        </>
      )}
    </div>
  );
}
