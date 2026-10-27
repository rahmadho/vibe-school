import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getSchool } from "@/lib/data/schools";
import { prisma } from "@/lib/prisma";
import { bolehFitur } from "@/lib/entitlement";
import { rootDomainConfigFromEnv } from "@/lib/site-host";
import { hostAdaDiZonaTerpercaya, zonaTerpercayaFromEnv } from "@/lib/domain-verify";
import { PageHeader } from "@/components/data-table";
import { updateSchool } from "../../actions";
import { daftarkanDomain, hapusDomain, verifikasiDomainAction } from "../../domain-actions";
import { DomainPanel } from "../../domain-panel";
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
  const [school, aliases, bolehWhiteLabel] = await Promise.all([
    getSchool(id),
    prisma.schoolHostAlias.findMany({
      where: { schoolId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, host: true, verifyStatus: true, verifyToken: true },
    }),
    bolehFitur(id, "whiteLabel"),
  ]);
  if (!school) notFound();

  const { rootDomain } = rootDomainConfigFromEnv();
  const zona = [
    school.customDomain,
    ...aliases.map((a) => a.host),
  ].some((h) => h && hostAdaDiZonaTerpercaya(h, zonaTerpercayaFromEnv()));

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
          waSenderName: school.waSenderName ?? "",
          isActive: school.isActive,
        }}
      />

      {/* Domain sengaja DI LUAR SchoolForm: pendaftaran & verifikasi adalah
          aksi sendiri, bukan bagian dari "Simpan perubahan". */}
      <DomainPanel
        schoolId={school.id}
        customDomain={school.customDomain}
        customStatus={school.domainVerifyStatus}
        customToken={school.domainVerifyToken}
        aliases={aliases}
        rootDomain={rootDomain}
        zonaTerpercaya={zona}
        bolehWhiteLabel={bolehWhiteLabel}
        daftar={daftarkanDomain}
        verifikasi={verifikasiDomainAction}
        hapus={hapusDomain}
      />
    </div>
  );
}
