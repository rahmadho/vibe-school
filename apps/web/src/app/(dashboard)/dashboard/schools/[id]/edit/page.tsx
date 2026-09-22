import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getSchool } from "@/lib/data/schools";
import { PageHeader } from "@/components/data-table";
import { updateSchool } from "../../actions";
import { SchoolForm } from "../../school-form";

export const metadata = { title: "Ubah sekolah" };

export default async function EditSchoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "schools", "manage", session.user.permissions)) {
    return <p className="text-slate">Halaman ini khusus untuk super-admin.</p>;
  }

  const { id } = await params;
  const school = await getSchool(id);
  if (!school) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Ubah: ${school.name}`} context={school.slug} />
      <SchoolForm
        mode="edit"
        action={updateSchool}
        initial={{
          id: school.id,
          name: school.name,
          slug: school.slug,
          npsn: school.npsn ?? "",
          level: school.level,
          address: school.address ?? "",
          phone: school.phone ?? "",
          email: school.email ?? "",
          timezone: school.timezone,
          themeColor: school.themeColor ?? "#1E6B52",
          customDomain: school.customDomain ?? "",
          waSenderName: school.waSenderName ?? "",
          isActive: school.isActive,
        }}
      />
    </div>
  );
}
