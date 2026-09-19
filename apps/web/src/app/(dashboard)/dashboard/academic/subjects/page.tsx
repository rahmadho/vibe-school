import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listSubjects } from "@/lib/data/academic";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { createSubject, updateSubject, softDeleteSubject } from "../actions";
import { SubjectForm } from "./subject-client";
import { SubjectRow } from "./subject-row";

export const metadata = { title: "Mata pelajaran" };

export default async function SubjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const subjects = await listSubjects(session.user.schoolId);
  const canManage = can(session.user.role, "academic", "manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mata pelajaran"
        context={`${subjects.length} mapel · KKM dipakai saat penilaian`}
      />

      {canManage ? <SubjectForm mode="create" action={createSubject} /> : null}

      {subjects.length === 0 ? (
        <EmptyState
          title="Belum ada mata pelajaran"
          description="Tambahkan mapel (misalnya Matematika, Bahasa Indonesia) sebelum menyusun jadwal dan menetapkan guru pengampu."
        />
      ) : (
        <Table
          head={
            <>
              <th className="w-28">Kode</th>
              <th>Nama</th>
              <th className="w-24">KKM</th>
              <th className="w-32">Guru pengampu</th>
              {canManage ? <th className="w-48 text-right">Aksi</th> : null}
            </>
          }
        >
          {subjects.map((s) => (
            <SubjectRow
              key={s.id}
              subject={{
                id: s.id,
                code: s.code,
                name: s.name,
                kkm: s.kkm,
                teacherCount: s._count.teachers,
              }}
              updateAction={updateSubject}
              deleteAction={softDeleteSubject}
            />
          ))}
        </Table>
      )}
    </div>
  );
}
