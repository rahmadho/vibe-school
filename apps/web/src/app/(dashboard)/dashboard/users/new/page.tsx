import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/data-table";
import { createUser } from "../actions";
import { UserForm } from "../user-form";

export const metadata = { title: "Buat akun" };

export default async function NewUserPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "users", "manage", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya izin membuat akun.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buat akun"
        context="Akun dipakai untuk masuk ke aplikasi."
      />
      <UserForm mode="create" actorRole={session.user.role} action={createUser} />
    </div>
  );
}
