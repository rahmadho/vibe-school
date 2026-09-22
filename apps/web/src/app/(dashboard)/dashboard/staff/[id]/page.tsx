import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getStaff } from "@/lib/data/personnel";
import { STAFF_POSITION_LABEL } from "@/lib/validations/personnel";
import { Button } from "@/components/ui";
import { PageHeader } from "@/components/data-table";
import { DeleteButton } from "@/components/delete-button";
import { softDeleteStaff } from "../actions";

export const metadata = { title: "Detail staf" };

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const { id } = await params;
  const staff = await getStaff(session.user.schoolId, id);
  if (!staff) notFound();

  const canManage = can(session.user.role, "teachers", "manage", session.user.permissions);

  return (
    <div className="space-y-6">
      <PageHeader
        title={staff.fullName}
        context={staff.nip ? `NIP ${staff.nip}` : "Tanpa NIP"}
        actions={
          <>
            <Link href="/dashboard/staff">
              <Button variant="ghost">Kembali</Button>
            </Link>
            {canManage ? (
              <Link href={`/dashboard/staff/${staff.id}/edit`}>
                <Button>Ubah</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <section className="card">
        <h2 className="card-title">Data staf</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate">Nama lengkap</dt>
            <dd className="mt-0.5 text-sm text-ink">{staff.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate">NIP</dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">
              {staff.nip ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Jabatan</dt>
            <dd className="mt-0.5 text-sm text-ink">
              {staff.position
                ? (STAFF_POSITION_LABEL[
                    staff.position as keyof typeof STAFF_POSITION_LABEL
                  ] ?? staff.position)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate">No. WA</dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">
              {staff.phone ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Email</dt>
            <dd className="mt-0.5 text-sm text-ink">{staff.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Status</dt>
            <dd className="mt-0.5 text-sm text-ink">
              {staff.isActive ? "Aktif" : "Nonaktif"}
            </dd>
          </div>
        </dl>
      </section>

      {canManage ? (
        <div className="rounded-lg border border-chalk bg-white p-5">
          <h2 className="text-sm font-medium text-ink">Nonaktifkan staf</h2>
          <p className="mt-1 max-w-prose text-sm text-slate">
            Staf tidak dihapus permanen — hanya disembunyikan dari daftar.
          </p>
          <div className="mt-3">
            <DeleteButton
              id={staff.id}
              name={staff.fullName}
              entityLabel="staf"
              redirectTo="/dashboard/staff"
              action={softDeleteStaff}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
