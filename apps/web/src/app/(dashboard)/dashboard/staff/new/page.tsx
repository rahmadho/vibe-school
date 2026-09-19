import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/data-table";
import { createStaff } from "../actions";
import { StaffForm } from "../staff-form";

export const metadata = { title: "Tambah staf" };

export default async function NewStaffPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "teachers", "manage")) {
    return <p className="text-slate">Anda tidak punya izin menambah staf.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tambah staf" context="Isi data pokok staf." />
      <StaffForm mode="create" action={createStaff} />
    </div>
  );
}
