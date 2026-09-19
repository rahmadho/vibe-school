import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can, ALL_MODULES, ROLE_DESCRIPTION } from "@/lib/rbac";
import { getUser } from "@/lib/data/users";
import { USER_ROLE_LABEL } from "@/lib/validations/user";
import { formatDateLong } from "@/lib/format";
import { Button } from "@/components/ui";
import { PageHeader } from "@/components/data-table";
import { DeleteButton } from "@/components/delete-button";
import { softDeleteUser, resetUserPassword } from "../actions";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Detail pengguna" };

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const { id } = await params;
  const user = await getUser(session.user.schoolId, id);
  if (!user) notFound();

  const canManage = can(session.user.role, "users", "manage");
  const isSelf = user.id === session.user.id;

  // Modul yang bisa diakses role ini.
  const allowed = ALL_MODULES.filter((m) => can(user.role, m, "read"));

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name}
        context={`${USER_ROLE_LABEL[user.role]} · ${user.email}`}
        actions={
          <>
            <Link href="/dashboard/users">
              <Button variant="ghost">Kembali</Button>
            </Link>
            {canManage ? (
              <Link href={`/dashboard/users/${user.id}/edit`}>
                <Button>Ubah</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="card-title">Data akun</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate">Nama</dt>
              <dd className="mt-0.5 text-sm text-ink">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate">Email</dt>
              <dd className="mt-0.5 font-mono text-sm text-ink">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate">Role</dt>
              <dd className="mt-0.5 text-sm text-ink">
                {USER_ROLE_LABEL[user.role]}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate">No. WA</dt>
              <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">
                {user.phone ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate">Status</dt>
              <dd className="mt-0.5 text-sm text-ink">
                {user.isActive ? "Aktif" : "Nonaktif"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate">Terakhir masuk</dt>
              <dd className="mt-0.5 text-sm text-ink">
                {user.lastLoginAt ? formatDateLong(user.lastLoginAt) : "Belum pernah"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2 className="card-title">Hak akses</h2>
          <p className="mt-1 text-xs text-slate">{ROLE_DESCRIPTION[user.role]}</p>
          <ul className="mt-3 space-y-1 text-sm text-slate">
            {allowed.map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
        </section>
      </div>

      {canManage && !isSelf ? (
        <div className="rounded-lg border border-chalk bg-white p-5">
          <h2 className="text-sm font-medium text-ink">Keamanan akun</h2>
          <p className="mt-1 max-w-prose text-sm text-slate">
            Setel ulang password bila pengguna lupa, atau nonaktifkan akun bila
            sudah tidak digunakan. Semua tindakan tercatat di log.
          </p>
          <div className="mt-3 space-y-4">
            <ResetPasswordForm id={user.id} action={resetUserPassword} />
            <div className="border-t border-chalk pt-4">
              <DeleteButton
                id={user.id}
                name={user.name}
                entityLabel="akun"
                redirectTo="/dashboard/users"
                action={softDeleteUser}
                description="Nonaktifkan akun"
              />
            </div>
          </div>
        </div>
      ) : isSelf ? (
        <p className="text-sm text-slate">
          Ini akun Anda sendiri. Untuk mengubah password, gunakan menu pengaturan
          akun (belum tersedia) atau hubungi super-admin.
        </p>
      ) : null}
    </div>
  );
}
