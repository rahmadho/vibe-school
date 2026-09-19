import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { modulesFor } from "@/lib/rbac";
import { Sidebar } from "@/components/sidebar";

/**
 * Layout dashboard — gerbang otorisasi utama (selain middleware).
 * Ambil sekolah dari DB (bukan dari klien) untuk menampilkan identitas.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role, schoolId, name } = session.user;

  // SUPER_ADMIN lintas-sekolah tidak punya schoolId → tampilkan label khusus.
  let schoolName = "Semua Sekolah";
  if (schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    schoolName = school?.name ?? "Sekolah tidak ditemukan";
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar
        schoolName={schoolName}
        userName={name ?? "Pengguna"}
        role={role}
        modules={modulesFor(role)}
      />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
