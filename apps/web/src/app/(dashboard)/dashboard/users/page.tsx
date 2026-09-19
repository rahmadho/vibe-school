import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listUsers, getUserStats } from "@/lib/data/users";
import { userFilterSchema, USER_ROLE_LABEL } from "@/lib/validations/user";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState, Pagination } from "@/components/data-table";

export const metadata = { title: "Pengguna" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const sp = await searchParams;
  const filter = userFilterSchema.parse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    role: typeof sp.role === "string" ? sp.role : undefined,
    active: typeof sp.active === "string" ? sp.active : undefined,
    page: sp.page ?? 1,
    perPage: sp.perPage ?? 20,
  });

  const [result, stats] = await Promise.all([
    listUsers(session.user.schoolId, filter),
    getUserStats(session.user.schoolId),
  ]);

  const canManage = can(session.user.role, "users", "manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengguna"
        context={`${stats.total} akun · ${stats.active} aktif · ${stats.admins} admin · ${stats.teachers} guru`}
        actions={
          canManage ? (
            <Link href="/dashboard/users/new">
              <Button>Buat akun</Button>
            </Link>
          ) : null
        }
      />

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
        action="/dashboard/users"
      >
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate">
            Cari
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="Nama atau email"
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          />
        </div>
        <div className="w-48">
          <label htmlFor="role" className="mb-1 block text-xs font-medium text-slate">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={filter.role ?? ""}
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          >
            <option value="">Semua role</option>
            {Object.entries(USER_ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
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
          title="Belum ada akun"
          description="Buat akun login untuk guru, staf, atau admin. Akun inilah yang dipakai untuk masuk ke aplikasi."
          action={
            canManage ? (
              <Link href="/dashboard/users/new">
                <Button>Buat akun</Button>
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <Table
            head={
              <>
                <th>Nama</th>
                <th className="w-56">Email</th>
                <th className="w-40">Role</th>
                <th className="w-32">Terakhir masuk</th>
                <th className="w-24">Status</th>
                <th className="w-24 text-right">Aksi</th>
              </>
            }
          >
            {result.items.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link
                    href={`/dashboard/users/${u.id}`}
                    className="font-medium text-ink hover:text-board"
                  >
                    {u.name}
                  </Link>
                </td>
                <td className="font-mono text-xs text-slate">{u.email}</td>
                <td className="text-slate">{USER_ROLE_LABEL[u.role]}</td>
                <td className="text-xs text-slate">
                  {u.lastLoginAt ? formatDate(u.lastLoginAt) : "Belum pernah"}
                </td>
                <td className="text-slate">{u.isActive ? "Aktif" : "Nonaktif"}</td>
                <td className="text-right">
                  <Link
                    href={`/dashboard/users/${u.id}`}
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
            basePath="/dashboard/users"
            params={{
              q: filter.q,
              role: filter.role,
              active: filter.active,
              perPage: String(filter.perPage),
            }}
          />
        </>
      )}
    </div>
  );
}
