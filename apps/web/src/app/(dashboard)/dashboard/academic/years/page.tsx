import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listAcademicYears } from "@/lib/data/academic";
import { formatDate } from "@/lib/format";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import {
  createAcademicYear,
  activateAcademicYear,
  deleteAcademicYear,
} from "../actions";
import { AcademicYearForm, RowAction } from "../year-client";

export const metadata = { title: "Tahun ajaran" };

export default async function AcademicYearsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const years = await listAcademicYears(session.user.schoolId);
  const canManage = can(session.user.role, "academic", "manage", session.user.permissions);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tahun ajaran"
        context="Hanya satu tahun ajaran yang aktif pada satu waktu."
      />

      {canManage ? <AcademicYearForm action={createAcademicYear} /> : null}

      {years.length === 0 ? (
        <EmptyState
          title="Belum ada tahun ajaran"
          description="Buat tahun ajaran dulu sebelum membuat kelas dan jadwal. Contoh: 2025/2026 dengan rentang 1 Juli 2025 – 30 Juni 2026."
        />
      ) : (
        <Table
          head={
            <>
              <th>Tahun ajaran</th>
              <th className="w-40">Mulai</th>
              <th className="w-40">Selesai</th>
              <th className="w-28">Kelas</th>
              <th className="w-28">Semester</th>
              <th className="w-32">Status</th>
              {canManage ? <th className="w-56 text-right">Aksi</th> : null}
            </>
          }
        >
          {years.map((y) => (
            <tr key={y.id}>
              <td className="font-display text-lg text-ink tabular-display">
                {y.name}
              </td>
              <td className="text-slate">{formatDate(y.startDate)}</td>
              <td className="text-slate">{formatDate(y.endDate)}</td>
              <td className="tabular-nums text-slate">{y._count.classes}</td>
              <td className="tabular-nums text-slate">{y._count.semesters}</td>
              <td>
                {y.isActive ? (
                  <span className="inline-flex items-center gap-2 text-sm text-board">
                    <span className="h-1.5 w-1.5 rounded-full bg-board" />
                    Aktif
                  </span>
                ) : (
                  <span className="text-sm text-slate">Nonaktif</span>
                )}
              </td>
              {canManage ? (
                <td>
                  <div className="flex justify-end gap-2">
                    {!y.isActive ? (
                      <RowAction
                        id={y.id}
                        label="Aktifkan"
                        confirm="Aktifkan tahun ini?"
                        variant="secondary"
                        action={activateAcademicYear}
                      />
                    ) : null}
                    {y._count.classes === 0 ? (
                      <RowAction
                        id={y.id}
                        label="Hapus"
                        confirm="Hapus tahun ajaran ini?"
                        variant="danger"
                        action={deleteAcademicYear}
                      />
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
