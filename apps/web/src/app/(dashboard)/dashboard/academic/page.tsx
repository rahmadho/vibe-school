import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/data-table";

export const metadata = { title: "Akademik" };

const LINKS = [
  {
    href: "/dashboard/academic/years",
    title: "Tahun ajaran",
    desc: "Buat & aktifkan tahun ajaran. Kelas dan jadwal mengacu ke sini.",
  },
  {
    href: "/dashboard/academic/classes",
    title: "Kelas",
    desc: "Daftar kelas per tahun ajaran, wali kelas, dan kapasitas.",
  },
  {
    href: "/dashboard/academic/subjects",
    title: "Mata pelajaran",
    desc: "Mapel dengan kode dan KKM, dipakai saat penilaian & jadwal.",
  },
  {
    href: "/dashboard/academic/time-slots",
    title: "Jam pelajaran",
    desc: "Kerangka waktu sekolah (jam ke-1, ke-2, …). Dasar penyusunan jadwal.",
  },
  {
    href: "/dashboard/academic/schedules",
    title: "Jadwal pelajaran",
    desc: "Susun jadwal per kelas atau per guru. Bentrok dicegah otomatis.",
  },
];

export default async function AcademicIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Akademik"
        context="Fondasi data sebelum menyusun jadwal, absensi, dan penilaian."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="card transition-colors hover:border-board/40"
          >
            <h2 className="font-display text-xl text-ink">{l.title}</h2>
            <p className="mt-2 text-sm text-slate">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
