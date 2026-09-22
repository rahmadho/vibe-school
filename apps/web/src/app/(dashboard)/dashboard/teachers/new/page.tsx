import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getSubjectOptions } from "@/lib/data/personnel";
import { PageHeader } from "@/components/data-table";
import { createTeacher } from "../actions";
import { TeacherForm } from "../teacher-form";

export const metadata = { title: "Tambah guru" };

export default async function NewTeacherPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "teachers", "manage", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya izin menambah guru.</p>;
  }

  const subjects = await getSubjectOptions(session.user.schoolId);

  return (
    <div className="space-y-6">
      <PageHeader title="Tambah guru" context="Isi data pokok guru." />
      <TeacherForm mode="create" subjects={subjects} action={createTeacher} />
    </div>
  );
}
