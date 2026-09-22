import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getStaff } from "@/lib/data/personnel";
import { PageHeader } from "@/components/data-table";
import { updateStaff } from "../../actions";
import { StaffForm } from "../../staff-form";

export const metadata = { title: "Ubah staf" };

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "teachers", "manage", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya izin mengubah staf.</p>;
  }

  const { id } = await params;
  const staff = await getStaff(session.user.schoolId, id);
  if (!staff) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Ubah: ${staff.fullName}`} />
      <StaffForm
        mode="edit"
        action={updateStaff}
        initial={{
          id: staff.id,
          nip: staff.nip ?? "",
          fullName: staff.fullName,
          position: staff.position ?? "",
          phone: staff.phone ?? "",
          email: staff.email ?? "",
          isActive: staff.isActive,
        }}
      />
    </div>
  );
}
