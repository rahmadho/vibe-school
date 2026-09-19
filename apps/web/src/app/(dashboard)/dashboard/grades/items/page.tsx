import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listGradeItems, getActiveAcademicYear } from "@/lib/data/grades";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { Select } from "@/components/form-fields";
import { GRADE_TYPE_LABEL, type GradeTypeValue } from "@/lib/validations/grade";
import {
  createGradeItem,
  updateGradeItem,
  deleteGradeItem,
} from "../actions";
import { GradeItemForm, GradeItemRow } from "../grade-item-client";

export const metadata = { title: "Komponen nilai" };

export default async function GradeItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "grades", "manage")) {
    return <p className="text-slate">Halaman ini untuk guru dan admin.</p>;
  }

  const sp = await searchParams;
  const [subjects, year, teachers] = await Promise.all([
    prisma.subject.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kkm: true },
    }),
    getActiveAcademicYear(schoolId),
    prisma.teacher.findMany({
      where: { schoolId, deletedAt: null, isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  const subjectId =
    typeof sp.subjectId === "string" ? sp.subjectId : subjects[0]?.id ?? "";

  const items =
    subjectId && year
      ? await listGradeItems(schoolId, { subjectId, academicYearId: year.id })
      : [];

  const totalWeight = items.reduce((a, c) => a + c.weight, 0);
  const activeSubject = subjects.find((s) => s.id === subjectId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Komponen nilai"
        context={
          activeSubject
            ? `${activeSubject.name} · total bobot ${totalWeight}%`
            : "Susun komponen penilaian (UTS, UAS, Tugas, …)"
        }
        actions={
          <Link href="/dashboard/grades">
            <Button variant="ghost">Kembali ke penilaian</Button>
          </Link>
        }
      />

      {subjects.length === 0 || !year ? (
        <EmptyState
          title="Belum bisa menyusun komponen"
          description="Diperlukan mata pelajaran dan tahun ajaran aktif. Lengkapi di menu Akademik."
          action={
            <Link href="/dashboard/academic">
              <Button>Buka Akademik</Button>
            </Link>
          }
        />
      ) : (
        <>
          <form action="/dashboard/grades/items" className="flex items-end gap-3">
            <div className="w-72">
              <label htmlFor="subjectId" className="mb-1 block text-xs font-medium text-slate">
                Mata pelajaran
              </label>
              <Select id="subjectId" name="subjectId" defaultValue={subjectId}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Tampilkan</Button>
          </form>

          {totalWeight !== 100 && items.length > 0 ? (
            <p className="rounded border border-marker/30 bg-marker/5 px-3 py-2 text-sm text-marker">
              Total bobot {totalWeight}%. Idealnya berjumlah tepat 100% agar nilai
              akhir berbobot sesuai rencana.
            </p>
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              title="Belum ada komponen nilai"
              description="Komponen nilai adalah bagian penilaian seperti UTS, UAS, atau Tugas. Bobotnya menentukan pengaruh terhadap nilai akhir."
            />
          ) : (
            <Table
              head={
                <>
                  <th>Nama</th>
                  <th className="w-32">Jenis</th>
                  <th className="w-20">Bobot</th>
                  <th className="w-24">Maksimal</th>
                  <th className="w-24">Terisi</th>
                  <th className="w-44 text-right">Aksi</th>
                </>
              }
            >
              {items.map((it) => (
                <GradeItemRow
                  key={it.id}
                  item={{
                    id: it.id,
                    name: it.name,
                    typeLabel:
                      GRADE_TYPE_LABEL[it.type as GradeTypeValue] ?? it.type,
                    weight: it.weight,
                    maxScore: it.maxScore,
                    teacherName: it.teacher.fullName,
                    gradeCount: it._count.grades,
                  }}
                  updateAction={updateGradeItem}
                  deleteAction={deleteGradeItem}
                />
              ))}
            </Table>
          )}

          <div className="max-w-2xl rounded-lg border border-chalk bg-paper/40 p-4">
            <p className="mb-3 text-sm text-slate">
              Komponen baru akan dibuat untuk mapel{" "}
              <span className="font-medium text-ink">{activeSubject?.name}</span>,
              tahun ajaran{" "}
              <span className="font-medium text-ink">{year.name}</span>.
            </p>
            <GradeItemForm
              action={createGradeItem}
              context={{
                subjectId,
                academicYearId: year.id,
                teacherId: teachers[0]?.id ?? "",
              }}
            />
            {teachers.length === 0 ? (
              <p className="mt-2 text-xs text-marker">
                Belum ada guru terdaftar. Tambahkan guru agar komponen nilai bisa
                disimpan.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
