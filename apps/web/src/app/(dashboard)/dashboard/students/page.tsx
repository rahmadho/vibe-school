import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  listStudents,
  getClassOptions,
  getStudentStats,
  countUnassignedStudents,
} from "@/lib/data/students";
import { getMajorOptions } from "@/lib/data/academic";
import { majorTerminology } from "@/lib/major-labels";
import { studentFilterSchema } from "@/lib/validations/student";
import {
  GENDER_LABEL,
  STUDENT_STATUS_LABEL,
} from "@/lib/validations/student";
import { can } from "@/lib/rbac";
import { Button } from "@/components/ui";
import {
  PageHeader,
  Table,
  StatusMarker,
  EmptyState,
  Pagination,
} from "@/components/data-table";
import { StudentFilters } from "./filters";

export const metadata = { title: "Siswa" };

/**
 * Daftar siswa — pola cetakan untuk entitas data master lain.
 * Tabel seperti buku induk: NIS tabular, header sticky, filter di atas.
 */
export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) {
    return (
      <p className="text-slate">
        Akun lintas-sekolah. Pilih sekolah untuk mengelola data siswa.
      </p>
    );
  }

  const schoolId = session.user.schoolId;
  const sp = await searchParams;

  // Tahun ajaran aktif dipakai sebagai bawaan filter kelas. Tanpa ini, sekolah
  // yang sudah berjalan dua tahun melihat "7A" dua kali di dropdown — dari
  // tahun lalu dan tahun ini — dengan nama yang tampak identik.
  const years = await prisma.academicYear.findMany({
    where: { schoolId },
    select: { id: true, name: true, isActive: true },
    orderBy: { startDate: "desc" },
  });
  const activeYear = years.find((y) => y.isActive);

  const rawYear = typeof sp.academicYearId === "string" ? sp.academicYearId : "";
  const academicYearId = rawYear === "all" ? undefined : (rawYear || activeYear?.id);

  const filter = studentFilterSchema.parse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    classId: typeof sp.classId === "string" ? sp.classId : undefined,
    majorId: typeof sp.majorId === "string" ? sp.majorId : undefined,
    academicYearId,
    status: typeof sp.status === "string" ? sp.status : undefined,
    page: sp.page ?? 1,
    perPage: sp.perPage ?? 20,
  });

  // Siswa tanpa kelas hanya disertakan saat melihat tahun ajaran AKTIF —
  // merekalah yang sedang menunggu ditempatkan.
  const viewingActiveYear = academicYearId === activeYear?.id;

  const [result, classes, majors, school, stats, unassignedCount] = await Promise.all([
    listStudents(schoolId, filter, { includeUnassigned: viewingActiveYear }),
    // SEMUA kelas dikirim, bukan hanya tahun terpilih. Alasannya: operator
    // mengganti pemilih tahun untuk melihat pilihannya SEBELUM menekan
    // "Terapkan", dan penyaringan di peramban butuh daftar lengkapnya. Jumlah
    // kelas satu sekolah hanya puluhan baris — jauh lebih murah daripada
    // memaksa satu perjalanan bolak-balik ke server untuk setiap percobaan.
    getClassOptions(schoolId),
    getMajorOptions(schoolId),
    prisma.school.findUnique({ where: { id: schoolId }, select: { level: true } }),
    getStudentStats(schoolId),
    countUnassignedStudents(schoolId),
  ]);

  // `getClassOptions(schoolId, undefined)` sudah mengembalikan SELURUH kelas —
  // jadi saat "Semua tahun" dipilih, `classes` memang sudah lengkap dan tidak
  // perlu diambil ulang.

  const term = majorTerminology(school?.level);
  const canManage = can(session.user.role, "students", "create", session.user.permissions);
  const hasFilter = Boolean(filter.q || filter.classId || filter.majorId || filter.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Siswa"
        context={`${stats.total} siswa · ${stats.active} aktif · ${stats.male} L / ${stats.female} P`}
        actions={
          canManage ? (
            <>
              <Link href="/dashboard/students/import">
                <Button variant="secondary">Import</Button>
              </Link>
              <Link href="/dashboard/students/new">
                <Button>Tambah siswa</Button>
              </Link>
            </>
          ) : null
        }
      />

      <StudentFilters
        classes={classes}
        majors={majors}
        years={years}
        terminology={term.singular}
        unassignedCount={unassignedCount}
        current={{
          q: filter.q ?? "",
          classId: filter.classId ?? "",
          majorId: filter.majorId ?? "",
          // Yang dikirim adalah tahun EFEKTIF, bukan nilai mentah dari URL.
          // Bila dikirim mentah (""), komponen filter mengira "tidak ada
          // penyaringan" lalu menampilkan kelas dari SEMUA tahun — padahal
          // server sudah menyaring siswa ke tahun aktif. Akibatnya daftar
          // kelas dan daftar siswa saling bertentangan.
          academicYearId: rawYear === "all" ? "all" : (academicYearId ?? ""),
          status: filter.status ?? "",
        }}
      />

      {result.items.length === 0 ? (
        hasFilter ? (
          <EmptyState
            title="Tidak ada siswa yang cocok"
            description="Coba ubah kata kunci atau filter, atau kosongkan pencarian untuk melihat semua siswa."
            action={
              <Link href="/dashboard/students">
                <Button variant="secondary">Hapus filter</Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="Belum ada siswa"
            description="Tambahkan siswa satu per satu, atau impor dari file Excel bila datanya sudah ada."
            action={
              canManage ? (
                <div className="flex gap-2">
                  <Link href="/dashboard/students/import">
                    <Button variant="secondary">Import dari Excel</Button>
                  </Link>
                  <Link href="/dashboard/students/new">
                    <Button>Tambah siswa</Button>
                  </Link>
                </div>
              ) : null
            }
          />
        )
      ) : (
        <>
          <Table
            head={
              <>
                <th className="w-28">NIS</th>
                <th>Nama</th>
                <th className="w-24">Kelas</th>
                {majors.length > 0 ? <th className="w-28">{term.singular}</th> : null}
                <th className="w-28">Jenis kelamin</th>
                <th className="w-32">Status</th>
                <th className="w-24 text-right">Aksi</th>
              </>
            }
          >
            {result.items.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs tabular-nums text-slate">
                  {s.nis}
                </td>
                <td>
                  <Link
                    href={`/dashboard/students/${s.id}`}
                    className="font-medium text-ink hover:text-board"
                  >
                    {s.fullName}
                  </Link>
                </td>
                <td className="text-slate">{s.class?.name ?? "—"}</td>
                {majors.length > 0 ? (
                  <td className="text-xs text-slate">{s.major?.code ?? "—"}</td>
                ) : null}
                <td className="text-slate">{GENDER_LABEL[s.gender]}</td>
                <td>
                  <StatusMarker
                    status={s.status}
                    label={STUDENT_STATUS_LABEL[s.status]}
                  />
                </td>
                <td className="text-right">
                  <Link
                    href={`/dashboard/students/${s.id}`}
                    className="text-sm text-board hover:underline"
                  >
                    Lihat
                  </Link>
                </td>
              </tr>
            ))}
          </Table>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/dashboard/students"
            params={{
              q: filter.q,
              classId: filter.classId,
              status: filter.status,
              perPage: String(filter.perPage),
            }}
          />
        </>
      )}
    </div>
  );
}
