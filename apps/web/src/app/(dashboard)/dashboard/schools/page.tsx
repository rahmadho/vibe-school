import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listSchools, getSchoolStats } from "@/lib/data/schools";
import { schoolFilterSchema, SCHOOL_LEVEL_LABEL } from "@/lib/validations/school";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState, Pagination } from "@/components/data-table";

export const metadata = { title: "Kelola sekolah" };

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "schools", "manage", session.user.permissions)) {
    return (
      <p className="text-slate">
        Halaman ini khusus untuk super-admin (pengelola sistem).
      </p>
    );
  }

  const sp = await searchParams;
  const filter = schoolFilterSchema.parse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    active: typeof sp.active === "string" ? sp.active : undefined,
    page: sp.page ?? 1,
    perPage: sp.perPage ?? 20,
  });

  const [result, stats] = await Promise.all([
    listSchools(filter),
    getSchoolStats(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelola sekolah"
        context={`${stats.schools} sekolah · ${stats.active} aktif · ${stats.students.toLocaleString("id-ID")} siswa · ${stats.users.toLocaleString("id-ID")} pengguna`}
        actions={
          <Link href="/dashboard/schools/new">
            <Button>Tambah sekolah</Button>
          </Link>
        }
      />

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
        action="/dashboard/schools"
      >
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate">
            Cari
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="Nama, slug, atau NPSN"
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          />
        </div>
        <div className="w-36">
          <label htmlFor="active" className="mb-1 block text-xs font-medium text-slate">
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
          title="Belum ada sekolah"
          description="Tambahkan sekolah untuk mulai menggunakan sistem. Setiap sekolah berdiri sendiri — datanya tidak bercampur."
          action={
            <Link href="/dashboard/schools/new">
              <Button>Tambah sekolah</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Table
            head={
              <>
                <th>Nama sekolah</th>
                <th className="w-20">Jenjang</th>
                <th className="w-24">Siswa</th>
                <th className="w-44">Paket</th>
                <th className="w-28">Status</th>
                <th className="w-24 text-right">Aksi</th>
              </>
            }
          >
            {result.items.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="flex items-center gap-2">
                    {s.themeColor ? (
                      <span
                        aria-hidden
                        className="h-3 w-3 shrink-0 rounded-full border border-chalk"
                        style={{ backgroundColor: s.themeColor }}
                      />
                    ) : null}
                    <Link
                      href={`/dashboard/schools/${s.id}`}
                      className="font-medium text-ink hover:text-board"
                    >
                      {s.name}
                    </Link>
                  </div>
                  <span className="font-mono text-xs text-slate">{s.slug}</span>
                </td>
                <td className="text-slate">{SCHOOL_LEVEL_LABEL[s.level]}</td>
                <td className="tabular-nums text-slate">
                  {s._count.students.toLocaleString("id-ID")}
                </td>
                <td className="text-slate">
                  {s.subscription ? (
                    <>
                      {s.subscription.plan.name}
                      <span className="ml-2 text-xs text-slate">
                        s/d {formatDate(s.subscription.expiresAt)}
                      </span>
                    </>
                  ) : (
                    "Belum berlangganan"
                  )}
                </td>
                <td>
                  {s.isActive ? (
                    <span className="inline-flex items-center gap-2 text-sm text-board">
                      <span className="h-1.5 w-1.5 rounded-full bg-board" />
                      Aktif
                    </span>
                  ) : (
                    <span className="text-sm text-slate">Nonaktif</span>
                  )}
                </td>
                <td className="text-right">
                  <Link
                    href={`/dashboard/schools/${s.id}`}
                    className="text-sm text-board hover:underline"
                  >
                    Kelola
                  </Link>
                </td>
              </tr>
            ))}
          </Table>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/dashboard/schools"
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
