import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getStudent } from "@/lib/data/students";
import {
  GENDER_LABEL,
  STUDENT_STATUS_LABEL,
} from "@/lib/validations/student";
import { Button } from "@/components/ui";
import { PageHeader, StatusMarker } from "@/components/data-table";
import { DeleteStudentButton } from "./delete-button";

export const metadata = { title: "Detail siswa" };

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const { id } = await params;
  const student = await getStudent(session.user.schoolId, id);
  if (!student) notFound();

  const canEdit = can(session.user.role, "students", "update");
  const canDelete = can(session.user.role, "students", "delete");

  const parent = student.parents[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.fullName}
        context={`NIS ${student.nis}${student.nisn ? ` · NISN ${student.nisn}` : ""}`}
        actions={
          <>
            <Link href="/dashboard/students">
              <Button variant="ghost">Kembali</Button>
            </Link>
            {canEdit ? (
              <Link href={`/dashboard/students/${student.id}/edit`}>
                <Button>Ubah</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Identitas */}
        <section className="card lg:col-span-2">
          <h2 className="card-title">Identitas</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Row label="Nama lengkap" value={student.fullName} />
            <Row label="Jenis kelamin" value={GENDER_LABEL[student.gender]} />
            <Row label="Tempat lahir" value={student.birthPlace ?? "—"} />
            <Row
              label="Tanggal lahir"
              value={
                student.birthDate
                  ? student.birthDate.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <Row label="Agama" value={student.religion ?? "—"} />
            <Row label="No. HP" value={student.phone ?? "—"} />
            <div className="sm:col-span-2">
              <Row label="Alamat" value={student.address ?? "—"} />
            </div>
          </dl>
        </section>

        {/* Status akademik */}
        <section className="card">
          <h2 className="card-title">Akademik</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-xs text-slate">Status</dt>
              <dd className="mt-1">
                <StatusMarker
                  status={student.status}
                  label={STUDENT_STATUS_LABEL[student.status]}
                />
              </dd>
            </div>
            <Row label="Kelas" value={student.class?.name ?? "Belum ditempatkan"} />
            <Row label="Tahun masuk" value={String(student.entryYear)} />
          </dl>
        </section>

        {/* Wali */}
        <section className="card lg:col-span-3">
          <h2 className="card-title">Wali / orang tua</h2>
          {parent ? (
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <Row label="Nama" value={parent.fullName} />
              <Row
                label="Hubungan"
                value={
                  parent.relation === "FATHER"
                    ? "Ayah"
                    : parent.relation === "MOTHER"
                      ? "Ibu"
                      : "Wali"
                }
              />
              <Row label="No. WA" value={parent.phone || "—"} />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate">
              Belum ada data wali. Tambahkan agar notifikasi WhatsApp bisa
              dikirim ke orang tua.
            </p>
          )}
        </section>
      </div>

      {canDelete ? (
        <div className="rounded-lg border border-chalk bg-white p-5">
          <h2 className="text-sm font-medium text-ink">Nonaktifkan siswa</h2>
          <p className="mt-1 max-w-prose text-sm text-slate">
            Siswa tidak dihapus permanen — hanya disembunyikan dari daftar.
            Riwayat akademik dan keuangan tetap tersimpan.
          </p>
          <div className="mt-3">
            <DeleteStudentButton id={student.id} name={student.fullName} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
