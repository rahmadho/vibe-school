import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getTeacher } from "@/lib/data/personnel";
import { GENDER_LABEL } from "@/lib/validations/personnel";
import { Button } from "@/components/ui";
import { PageHeader } from "@/components/data-table";
import { DeleteButton } from "@/components/delete-button";
import { softDeleteTeacher } from "../actions";

export const metadata = { title: "Detail guru" };

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const { id } = await params;
  const teacher = await getTeacher(session.user.schoolId, id);
  if (!teacher) notFound();

  const canManage = can(session.user.role, "teachers", "manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title={teacher.fullName}
        context={teacher.nip ? `NIP ${teacher.nip}` : "Tanpa NIP"}
        actions={
          <>
            <Link href="/dashboard/teachers">
              <Button variant="ghost">Kembali</Button>
            </Link>
            {canManage ? (
              <Link href={`/dashboard/teachers/${teacher.id}/edit`}>
                <Button>Ubah</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="card-title">Data diri</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Row label="Nama lengkap" value={teacher.fullName} />
            <Row label="NIP" value={teacher.nip ?? "—"} mono />
            <Row label="Jenis kelamin" value={GENDER_LABEL[teacher.gender]} />
            <Row label="No. WA" value={teacher.phone ?? "—"} mono />
            <Row label="Email" value={teacher.email ?? "—"} />
            <Row label="Status" value={teacher.isActive ? "Aktif" : "Nonaktif"} />
          </dl>
        </section>

        <section className="card">
          <h2 className="card-title">Ringkasan mengajar</h2>
          <dl className="mt-4 space-y-4">
            <Row
              label="Mata pelajaran diampu"
              value={String(teacher.subjects.length)}
              mono
            />
            <Row
              label="Wali kelas untuk"
              value={
                teacher.homeroomOf.length
                  ? teacher.homeroomOf.map((c) => c.name).join(", ")
                  : "—"
              }
            />
          </dl>
        </section>

        <section className="card lg:col-span-3">
          <h2 className="card-title">Mata pelajaran yang diampu</h2>
          {teacher.subjects.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {teacher.subjects.map((ts) => (
                <li
                  key={ts.subject.id}
                  className="rounded border border-chalk px-3 py-1.5 text-sm"
                >
                  <span className="text-ink">{ts.subject.name}</span>
                  <span className="ml-2 font-mono text-xs text-slate">
                    {ts.subject.code}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate">
              Belum ada mapel yang ditetapkan. Ubah data guru untuk memilih mapel.
            </p>
          )}
        </section>
      </div>

      {canManage ? (
        <div className="rounded-lg border border-chalk bg-white p-5">
          <h2 className="text-sm font-medium text-ink">Nonaktifkan guru</h2>
          <p className="mt-1 max-w-prose text-sm text-slate">
            Guru tidak dihapus permanen — hanya disembunyikan dan tidak bisa
            dipilih untuk jadwal baru. Riwayat tetap tersimpan.
          </p>
          <div className="mt-3">
            <DeleteButton
              id={teacher.id}
              name={teacher.fullName}
              entityLabel="guru"
              redirectTo="/dashboard/teachers"
              action={softDeleteTeacher}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate">{label}</dt>
      <dd className={`mt-0.5 text-sm text-ink ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
