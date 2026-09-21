import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getClassOptions } from "@/lib/data/students";
import { getMajorOptions } from "@/lib/data/academic";
import { majorTerminology } from "@/lib/major-labels";
import { PageHeader } from "@/components/data-table";
import { createStudent } from "../actions";
import { StudentForm } from "../student-form";

export const metadata = { title: "Tambah siswa" };

export default async function NewStudentPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "students", "create")) {
    return <p className="text-slate">Anda tidak punya izin menambah siswa.</p>;
  }

  const schoolId = session.user.schoolId;
  const [classes, majors, school] = await Promise.all([
    getClassOptions(schoolId),
    getMajorOptions(schoolId),
    prisma.school.findUnique({ where: { id: schoolId }, select: { level: true } }),
  ]);

  const term = majorTerminology(school?.level);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tambah siswa"
        context="Isi data pokok. Kolom bertanda wajib harus diisi."
      />
      <StudentForm
        mode="create"
        classes={classes}
        majors={majors}
        terminology={term.singular}
        action={createStudent}
      />
    </div>
  );
}
