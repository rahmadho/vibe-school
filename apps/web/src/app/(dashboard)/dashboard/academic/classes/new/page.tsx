import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getAcademicYearOptions } from "@/lib/data/academic";
import { getTeacherOptions } from "@/lib/data/personnel";
import { PageHeader } from "@/components/data-table";
import { createClass } from "../../actions";
import { ClassForm } from "../class-form";

export const metadata = { title: "Tambah kelas" };

export default async function NewClassPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "academic", "manage")) {
    return <p className="text-slate">Anda tidak punya izin menambah kelas.</p>;
  }

  const schoolId = session.user.schoolId;
  const [years, teachers] = await Promise.all([
    getAcademicYearOptions(schoolId),
    getTeacherOptions(schoolId),
  ]);

  if (years.length === 0) {
    return (
      <p className="text-slate">
        Buat tahun ajaran dulu sebelum menambah kelas.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tambah kelas" />
      <ClassForm mode="create" years={years} teachers={teachers} action={createClass} />
    </div>
  );
}
