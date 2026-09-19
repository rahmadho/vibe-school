import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/data-table";
import { createSchool } from "../actions";
import { SchoolForm } from "../school-form";

export const metadata = { title: "Tambah sekolah" };

export default async function NewSchoolPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "schools", "manage")) {
    return <p className="text-slate">Halaman ini khusus untuk super-admin.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tambah sekolah"
        context="Satu sekolah baru dengan datanya sendiri yang terisolasi."
      />
      <SchoolForm mode="create" action={createSchool} />
    </div>
  );
}
