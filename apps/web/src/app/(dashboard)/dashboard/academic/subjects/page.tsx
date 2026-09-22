import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listSubjects, getMajorOptions } from "@/lib/data/academic";
import { majorTerminology } from "@/lib/major-labels";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { createSubject, updateSubject, softDeleteSubject } from "../actions";
import { SubjectForm } from "./subject-client";
import { SubjectRow } from "./subject-row";

export const metadata = { title: "Mata pelajaran" };

export default async function SubjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const schoolId = session.user.schoolId;

  const [subjects, majors, school] = await Promise.all([
    listSubjects(schoolId),
    getMajorOptions(schoolId),
    prisma.school.findUnique({ where: { id: schoolId }, select: { level: true } }),
  ]);

  const canManage = can(session.user.role, "academic", "manage", session.user.permissions);
  const term = majorTerminology(school?.level);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mata pelajaran"
        context={`${subjects.length} mapel · KKM dipakai saat penilaian`}
      />

      {canManage ? (
        <SubjectForm
          mode="create"
          majors={majors}
          terminology={term.singular}
          action={createSubject}
        />
      ) : null}

      {subjects.length === 0 ? (
        <EmptyState
          title="Belum ada mata pelajaran"
          description="Tambahkan mapel (misalnya Matematika, Bahasa Indonesia) sebelum menyusun jadwal dan menetapkan guru pengampu."
        />
      ) : (
        <Table
          head={
            <>
              <th className="w-24">Kode</th>
              <th>Nama</th>
              <th className="w-56">Kelompok</th>
              <th className="w-20">KKM</th>
              <th className="w-28">Guru pengampu</th>
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
                group: s.group,
                majorId: s.major?.id ?? null,
                majorLabel: s.major?.code ?? null,
              }}
              majors={majors}
              terminology={term.singular}
              updateAction={updateSubject}
              deleteAction={softDeleteSubject}
            />
          ))}
        </Table>
      )}
    </div>
  );
}
