import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getClass } from "@/lib/data/academic";
import { GENDER_LABEL } from "@/lib/validations/student";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { DeleteButton } from "@/components/delete-button";
import { softDeleteClass } from "../../actions";

export const metadata = { title: "Detail kelas" };

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const { id } = await params;
  const klass = await getClass(session.user.schoolId, id);
  if (!klass) notFound();

  const canManage = can(session.user.role, "academic", "manage", session.user.permissions);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Kelas ${klass.name}`}
        context={`${klass.academicYear.name} · tingkat ${klass.level} · ${klass.students.length}/${klass.capacity} siswa`}
        actions={
          <>
            <Link href="/dashboard/academic/classes">
              <Button variant="ghost">Kembali</Button>
            </Link>
            {canManage ? (
              <Link href={`/dashboard/academic/classes/${klass.id}/edit`}>
                <Button>Ubah</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <section className="card">
        <h2 className="card-title">Ringkasan</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate">Wali kelas</dt>
            <dd className="mt-0.5 text-sm text-ink">
              {klass.homeroomTeacher?.fullName ?? "Belum ditentukan"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Kapasitas</dt>
            <dd className="mt-0.5 text-sm tabular-nums text-ink">
              {klass.capacity} siswa
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Terisi</dt>
            <dd className="mt-0.5 text-sm tabular-nums text-ink">
              {klass.students.length} siswa
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Daftar siswa</h2>
          <Link
            href={`/dashboard/students?classId=${klass.id}`}
            className="text-sm text-board hover:underline"
          >
            Buka di menu Siswa →
          </Link>
        </div>
        {klass.students.length === 0 ? (
          <EmptyState
            title="Kelas masih kosong"
            description="Belum ada siswa ditempatkan di kelas ini. Tempatkan siswa lewat form siswa atau fitur kenaikan kelas."
          />
        ) : (
          <Table
            head={
              <>
                <th className="w-28">NIS</th>
                <th>Nama</th>
                <th className="w-28">Gender</th>
                <th className="w-24 text-right">Aksi</th>
              </>
            }
          >
            {klass.students.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs tabular-nums text-slate">
                  {s.nis}
                </td>
                <td>
                  <Link
                    href={`/dashboard/students/${s.id}`}
                    className="font-medium text-ink hover:text-board"
                  >
                    {s.fullName}
                  </Link>
                </td>
                <td className="text-slate">{GENDER_LABEL[s.gender]}</td>
                <td className="text-right">
                  <Link
                    href={`/dashboard/students/${s.id}`}
                    className="text-sm text-board hover:underline"
                  >
                    Lihat
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {canManage ? (
        <div className="rounded-lg border border-chalk bg-white p-5">
          <h2 className="text-sm font-medium text-ink">Nonaktifkan kelas</h2>
          <p className="mt-1 max-w-prose text-sm text-slate">
            Kelas diarsipkan (tidak dihapus permanen). Siswa tetap tersimpan dan
            bisa dipindah ke kelas lain.
          </p>
          <div className="mt-3">
            <DeleteButton
              id={klass.id}
              name={klass.name}
              entityLabel="kelas"
              redirectTo="/dashboard/academic/classes"
              action={softDeleteClass}
              description="Nonaktifkan kelas"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
