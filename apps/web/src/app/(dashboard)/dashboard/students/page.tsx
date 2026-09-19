import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  listStudents,
  getClassOptions,
  getStudentStats,
} from "@/lib/data/students";
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
  const filter = studentFilterSchema.parse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    classId: typeof sp.classId === "string" ? sp.classId : undefined,
    status: typeof sp.status === "string" ? sp.status : undefined,
    page: sp.page ?? 1,
    perPage: sp.perPage ?? 20,
  });

  const [result, classes, stats] = await Promise.all([
    listStudents(schoolId, filter),
    getClassOptions(schoolId),
    getStudentStats(schoolId),
  ]);

  const canManage = can(session.user.role, "students", "create");
  const hasFilter = Boolean(filter.q || filter.classId || filter.status);

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
        current={{
          q: filter.q ?? "",
          classId: filter.classId ?? "",
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
