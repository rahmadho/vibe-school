import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listStaffs } from "@/lib/data/personnel";
import { staffFilterSchema, STAFF_POSITION_LABEL } from "@/lib/validations/personnel";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState, Pagination } from "@/components/data-table";

export const metadata = { title: "Staf" };

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const sp = await searchParams;
  const filter = staffFilterSchema.parse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    active: typeof sp.active === "string" ? sp.active : undefined,
    page: sp.page ?? 1,
    perPage: sp.perPage ?? 20,
  });

  const result = await listStaffs(session.user.schoolId, filter);
  const canManage = can(session.user.role, "teachers", "manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staf"
        context={`${result.total} staf terdaftar`}
        actions={
          canManage ? (
            <Link href="/dashboard/staff/new">
              <Button>Tambah staf</Button>
            </Link>
          ) : null
        }
      />

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
        action="/dashboard/staff"
      >
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate">
            Cari
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="Nama, NIP, atau jabatan"
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          />
        </div>
        <div className="w-40">
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
          title="Belum ada staf"
          description="Tambahkan data staf (tata usaha, bendahara, pustakawan, dll)."
          action={
            canManage ? (
              <Link href="/dashboard/staff/new">
                <Button>Tambah staf</Button>
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
                <th className="w-40">Jabatan</th>
                <th className="w-40">No. WA</th>
                <th className="w-24">Status</th>
                <th className="w-24 text-right">Aksi</th>
              </>
            }
          >
            {result.items.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs tabular-nums text-slate">
                  {s.nip ?? "—"}
                </td>
                <td>
                  <Link
                    href={`/dashboard/staff/${s.id}`}
                    className="font-medium text-ink hover:text-board"
                  >
                    {s.fullName}
                  </Link>
                </td>
                <td className="text-slate">
                  {s.position
                    ? (STAFF_POSITION_LABEL[
                        s.position as keyof typeof STAFF_POSITION_LABEL
                      ] ?? s.position)
                    : "—"}
                </td>
                <td className="font-mono text-xs tabular-nums text-slate">
                  {s.phone ?? "—"}
                </td>
                <td className="text-slate">{s.isActive ? "Aktif" : "Nonaktif"}</td>
                <td className="text-right">
                  <Link
                    href={`/dashboard/staff/${s.id}`}
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
            basePath="/dashboard/staff"
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
