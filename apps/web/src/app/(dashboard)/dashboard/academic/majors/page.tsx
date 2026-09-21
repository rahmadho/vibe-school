import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listMajors, getMajorStats } from "@/lib/data/academic";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { Button } from "@/components/ui";
import { majorTerminology } from "@/lib/major-labels";
import { createMajor, updateMajor, softDeleteMajor } from "../actions";
import { MajorForm } from "./major-client";
import { MajorRow } from "./major-row";

export const metadata = { title: "Jurusan" };

/**
 * Daftar jurusan / peminatan / kompetensi keahlian.
 *
 * Istilah di halaman ini MENGIKUTI JENJANG sekolah: SMA melihat "Peminatan",
 * SMK melihat "Kompetensi Keahlian". Struktur datanya satu (`model Major`),
 * jadi tidak ada halaman terpisah yang harus dirawat dua kali.
 */
export default async function MajorsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const schoolId = session.user.schoolId;

  const [majors, stats, school, teachers] = await Promise.all([
    listMajors(schoolId),
    getMajorStats(schoolId),
    prisma.school.findUnique({ where: { id: schoolId }, select: { level: true } }),
    prisma.teacher.findMany({
      where: { schoolId, deletedAt: null, isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const canManage = can(session.user.role, "academic", "manage");
  const term = majorTerminology(school?.level);

  return (
    <div className="space-y-6">
      <PageHeader
        title={term.plural}
        context={`${stats.total} ${term.singular.toLowerCase()} · ${stats.active} aktif · contoh: ${term.example}`}
        actions={
          <Link href="/dashboard/academic">
            <Button variant="ghost">Kembali</Button>
          </Link>
        }
      />

      {canManage ? (
        <MajorForm
          mode="create"
          teachers={teachers}
          terminology={term}
          action={createMajor}
        />
      ) : null}

      {majors.length === 0 ? (
        <EmptyState
          title={`Belum ada ${term.singular.toLowerCase()}`}
          description={
            term.typical
              ? `Tambahkan ${term.singular.toLowerCase()} seperti ${term.example} agar kelas, mapel, dan siswa dapat dikelompokkan dengan benar.`
              : `Fitur ini opsional untuk jenjang ini. Tambahkan bila sekolah memiliki program khusus yang perlu dibedakan.`
          }
        />
      ) : (
        <Table
          head={
            <>
              <th className="w-24">Kode</th>
              <th>Nama</th>
              <th className="w-52">Ketua program</th>
              <th className="w-20">Kelas</th>
              <th className="w-20">Siswa</th>
              <th className="w-28">Status</th>
              {canManage ? <th className="w-48 text-right">Aksi</th> : null}
            </>
          }
        >
          {majors.map((m) => (
            <MajorRow
              key={m.id}
              major={{
                id: m.id,
                code: m.code,
                name: m.name,
                description: m.description,
                isActive: m.isActive,
                headTeacherId: m.headTeacher?.id ?? null,
                headTeacherName: m.headTeacher?.fullName ?? null,
                classCount: m._count.classes,
                studentCount: m._count.students,
                subjectCount: m._count.subjects,
              }}
              teachers={teachers}
              terminology={term}
              updateAction={updateMajor}
              deleteAction={softDeleteMajor}
            />
          ))}
        </Table>
      )}
    </div>
  );
}
