import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getClassOptions } from "@/lib/data/students";
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

  const classes = await getClassOptions(session.user.schoolId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tambah siswa"
        context="Isi data pokok. Kolom bertanda wajib harus diisi."
      />
      <StudentForm mode="create" classes={classes} action={createStudent} />
    </div>
  );
}
