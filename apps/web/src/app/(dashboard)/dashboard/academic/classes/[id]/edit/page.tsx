import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getClass, getAcademicYearOptions, getMajorOptions } from "@/lib/data/academic";
import { getTeacherOptions } from "@/lib/data/personnel";
import { majorTerminology } from "@/lib/major-labels";
import { PageHeader } from "@/components/data-table";
import { updateClass } from "../../../actions";
import { ClassForm } from "../../class-form";

export const metadata = { title: "Ubah kelas" };

export default async function EditClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "academic", "manage", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya izin mengubah kelas.</p>;
  }

  const schoolId = session.user.schoolId;
  const { id } = await params;
  const [klass, years, teachers, majors, school] = await Promise.all([
    getClass(schoolId, id),
    getAcademicYearOptions(schoolId),
    getTeacherOptions(schoolId),
    getMajorOptions(schoolId),
    prisma.school.findUnique({ where: { id: schoolId }, select: { level: true } }),
  ]);
  if (!klass) notFound();

  const term = majorTerminology(school?.level);

  return (
    <div className="space-y-6">
      <PageHeader title={`Ubah kelas ${klass.name}`} />
      <ClassForm
        mode="edit"
        years={years}
        teachers={teachers}
        majors={majors}
        terminology={term.singular}
        action={updateClass}
        initial={{
          id: klass.id,
          name: klass.name,
          level: klass.level,
          capacity: klass.capacity,
          academicYearId: klass.academicYear.id,
          homeroomTeacherId: klass.homeroomTeacher?.id ?? "",
          majorId: klass.major?.id ?? "",
        }}
      />
    </div>
  );
}
