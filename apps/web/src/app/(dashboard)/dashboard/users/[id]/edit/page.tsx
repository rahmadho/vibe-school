import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getUser } from "@/lib/data/users";
import { PageHeader } from "@/components/data-table";
import { updateUser } from "../../actions";
import { UserForm } from "../../user-form";

export const metadata = { title: "Ubah akun" };

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "users", "manage", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya izin mengubah akun.</p>;
  }

  const { id } = await params;
  const user = await getUser(session.user.schoolId, id);
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Ubah: ${user.name}`} />
      <UserForm
        mode="edit"
        actorRole={session.user.role}
        action={updateUser}
        initial={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone ?? "",
          isActive: user.isActive,
        }}
      />
    </div>
  );
}
