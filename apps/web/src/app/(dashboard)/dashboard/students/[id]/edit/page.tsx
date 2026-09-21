import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getStudent, getClassOptions } from "@/lib/data/students";
import { getMajorOptions } from "@/lib/data/academic";
import { majorTerminology } from "@/lib/major-labels";
import { PageHeader } from "@/components/data-table";
import { updateStudent } from "../../actions";
import { StudentForm } from "../../student-form";

export const metadata = { title: "Ubah siswa" };

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "students", "update")) {
    return <p className="text-slate">Anda tidak punya izin mengubah siswa.</p>;
  }

  const schoolId = session.user.schoolId;
  const { id } = await params;
  const [student, classes, majors, school] = await Promise.all([
    getStudent(schoolId, id),
    getClassOptions(schoolId),
    getMajorOptions(schoolId),
    prisma.school.findUnique({ where: { id: schoolId }, select: { level: true } }),
  ]);

  if (!student) notFound();

  const term = majorTerminology(school?.level);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ubah: ${student.fullName}`}
        context={`NIS ${student.nis}`}
      />
      <StudentForm
        mode="edit"
        classes={classes}
        majors={majors}
        terminology={term.singular}
        action={updateStudent}
        initial={{
          id: student.id,
          nis: student.nis,
          nisn: student.nisn ?? "",
          fullName: student.fullName,
          gender: student.gender,
          birthPlace: student.birthPlace ?? "",
          birthDate: student.birthDate
            ? student.birthDate.toISOString().slice(0, 10)
            : "",
          religion: student.religion ?? "",
          address: student.address ?? "",
          phone: student.phone ?? "",
          entryYear: student.entryYear,
          classId: student.classId ?? "",
          majorId: student.majorId ?? "",
          status: student.status,
        }}
      />
    </div>
  );
}
