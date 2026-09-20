import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { modulesFor } from "@/lib/rbac";
import { getSchoolPreviewUrl } from "@/lib/site-preview";
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

  // Tautan web publik untuk tombol "Lihat Web Sekolah" di sidebar — tersedia
  // dari halaman mana pun agar operator tidak perlu membuka menu Identitas.
  const previewUrl = await getSchoolPreviewUrl(schoolId);

  /**
   * KENAPA `h-screen` + `overflow-hidden`, BUKAN `min-h-screen`:
   *
   * Dengan `min-h-screen`, tinggi kolom mengikuti ISI halaman. Saat halaman
   * panjang (daftar 200 siswa), seluruh dokumen ikut memanjang dan sidebar
   * `h-screen` tertinggal di atas — begitu digulir, menu hilang dari layar dan
   * operator harus menggulir kembali ke atas hanya untuk berpindah menu.
   *
   * Sekarang TINGGI JENDELA yang mengunci tata letak: sidebar diam, dan hanya
   * `<main>` yang bergulir. Karena gulirannya milik satu elemen, posisi menu
   * tidak pernah berubah — sama seperti aplikasi kerja pada umumnya.
   *
   * `min-w-0` pada <main> wajib: tanpa itu, tabel lebar menolak menyusut dan
   * mendorong sidebar keluar layar (perilaku bawaan flex item).
   */
  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar
        schoolName={schoolName}
        userName={name ?? "Pengguna"}
        role={role}
        modules={modulesFor(role)}
        previewUrl={previewUrl}
      />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
