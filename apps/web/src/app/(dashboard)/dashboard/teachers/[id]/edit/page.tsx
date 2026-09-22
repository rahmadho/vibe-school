import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getTeacher, getSubjectOptions } from "@/lib/data/personnel";
import { PageHeader } from "@/components/data-table";
import { updateTeacher } from "../../actions";
import { TeacherForm } from "../../teacher-form";

export const metadata = { title: "Ubah guru" };

export default async function EditTeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "teachers", "manage", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya izin mengubah guru.</p>;
  }

  const { id } = await params;
  const [teacher, subjects] = await Promise.all([
    getTeacher(session.user.schoolId, id),
    getSubjectOptions(session.user.schoolId),
  ]);
  if (!teacher) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Ubah: ${teacher.fullName}`} context={teacher.nip ?? undefined} />
      <TeacherForm
        mode="edit"
        subjects={subjects}
        action={updateTeacher}
        initial={{
          id: teacher.id,
          nip: teacher.nip ?? "",
          fullName: teacher.fullName,
          gender: teacher.gender,
          phone: teacher.phone ?? "",
          email: teacher.email ?? "",
          photoUrl: teacher.photoUrl ?? null,
          isActive: teacher.isActive,
          subjectIds: teacher.subjects.map((s) => s.subject.id),
        }}
      />
    </div>
  );
}
