import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getClass, getAcademicYearOptions } from "@/lib/data/academic";
import { getTeacherOptions } from "@/lib/data/personnel";
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
  if (!can(session.user.role, "academic", "manage")) {
    return <p className="text-slate">Anda tidak punya izin mengubah kelas.</p>;
  }

  const schoolId = session.user.schoolId;
  const { id } = await params;
  const [klass, years, teachers] = await Promise.all([
    getClass(schoolId, id),
    getAcademicYearOptions(schoolId),
    getTeacherOptions(schoolId),
  ]);
  if (!klass) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Ubah kelas ${klass.name}`} />
      <ClassForm
        mode="edit"
        years={years}
        teachers={teachers}
        action={updateClass}
        initial={{
          id: klass.id,
          name: klass.name,
          level: klass.level,
          capacity: klass.capacity,
          academicYearId: klass.academicYear.id,
          homeroomTeacherId: klass.homeroomTeacher?.id ?? "",
        }}
      />
    </div>
  );
}
