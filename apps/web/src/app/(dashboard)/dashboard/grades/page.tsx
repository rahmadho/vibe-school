import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  listGradeItems,
  listGradesForItems,
  getActiveAcademicYear,
  listSemestersOfActiveYear,
  getSubject,
} from "@/lib/data/grades";
import { Button } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/data-table";
import { Select } from "@/components/form-fields";
import { GRADE_TYPE_LABEL, type GradeTypeValue } from "@/lib/validations/grade";
import { saveGrades } from "./actions";
import { GradeSheet } from "./grade-sheet";

export const metadata = { title: "Penilaian" };

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "grades", "read")) {
    return <p className="text-slate">Anda tidak punya akses ke modul penilaian.</p>;
  }
  const canManage = can(session.user.role, "grades", "manage");

  const sp = await searchParams;

  const years = await prisma.academicYear.findMany({
    where: { schoolId },
    select: { id: true, name: true, isActive: true },
    orderBy: { startDate: "desc" },
  });
  const activeYear = years.find((y) => y.isActive);

  let academicYearId: string | undefined;
  if (sp.academicYearId === "all") {
    academicYearId = undefined;
  } else if (typeof sp.academicYearId === "string" && sp.academicYearId.length > 0) {
    academicYearId = sp.academicYearId;
  } else {
    academicYearId = activeYear?.id;
  }

  const effectiveYearId = academicYearId ?? activeYear?.id;

  const [classes, subjects, semesters] = await Promise.all([
    prisma.class.findMany({
      where: {
        schoolId,
        deletedAt: null,
        ...(academicYearId ? { academicYearId } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.subject.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kkm: true },
    }),
    effectiveYearId
      ? prisma.semester.findMany({
          where: { academicYearId: effectiveYearId },
          orderBy: { startDate: "asc" },
          select: { id: true, name: true },
        })
      : [],
  ]);
  const classId = typeof sp.classId === "string" ? sp.classId : classes[0]?.id ?? "";
  const subjectId =
    typeof sp.subjectId === "string" ? sp.subjectId : subjects[0]?.id ?? "";
  const semesterId =
    typeof sp.semesterId === "string"
      ? sp.semesterId
      : semesters[0]?.id ?? "";

  const subject = subjectId ? await getSubject(schoolId, subjectId) : null;

  const components =
    subjectId && effectiveYearId
      ? await listGradeItems(schoolId, { subjectId, academicYearId: effectiveYearId })
      : [];

  const [students, grades] = classId
    ? await Promise.all([
        prisma.student.findMany({
          where: { schoolId, classId, deletedAt: null },
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true, nis: true },
        }),
        listGradesForItems(schoolId, components.map((c) => c.id)),
      ])
    : [[], []];

  // Peta `${gradeItemId}:${studentId}` → skor
  const initial: Record<string, number> = {};
  for (const g of grades) {
    initial[`${g.gradeItemId}:${g.studentId}`] = g.score;
  }

  const kkm = subject?.kkm ?? 70;
  const totalWeight = components.reduce((a, c) => a + c.weight, 0);
  const hasPrereq =
    classes.length > 0 && subjects.length > 0 && effectiveYearId && semesters.length > 0;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Penilaian"
        context={
          subject
            ? `${subject.name} · KKM ${kkm}`
            : "Input nilai, hitung nilai akhir, dan susun rapor"
        }
        actions={
          <>
            <Link href="/dashboard/grades/report">
              <Button variant="secondary">Rapor</Button>
            </Link>
            <Link href="/dashboard/grades/items">
              <Button variant="ghost">Komponen nilai</Button>
            </Link>
          </>
        }
      />

      {!hasPrereq ? (
        <EmptyState
          title="Belum siap menilai"
          description="Penilaian membutuhkan kelas, mata pelajaran, tahun ajaran aktif, dan semester. Lengkapi dulu di menu Akademik."
          action={
            <Link href="/dashboard/academic">
              <Button>Buka Akademik</Button>
            </Link>
          }
        />
      ) : (
        <>
          <form
            action="/dashboard/grades"
            className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
          >
            <div className="w-52">
              <label htmlFor="academicYearId" className="mb-1 block text-xs font-medium text-slate">
                Tahun ajaran
              </label>
              <Select
                id="academicYearId"
                name="academicYearId"
                defaultValue={sp.academicYearId === "all" ? "all" : (academicYearId ?? "")}
              >
                <option value="all">Semua tahun</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isActive ? "(aktif)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-52">
              <label htmlFor="classId" className="mb-1 block text-xs font-medium text-slate">
                Kelas
              </label>
              <Select id="classId" name="classId" defaultValue={classId}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-56">
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
            <div className="w-44">
              <label htmlFor="semesterId" className="mb-1 block text-xs font-medium text-slate">
                Semester
              </label>
              <Select id="semesterId" name="semesterId" defaultValue={semesterId}>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Tampilkan</Button>
          </form>

          {totalWeight !== 100 && components.length > 0 ? (
            <p className="rounded border border-marker/30 bg-marker/5 px-3 py-2 text-sm text-marker">
              Total bobot komponen saat ini <strong>{totalWeight}%</strong> (belum
              100%). Nilai akhir tetap dinormalkan, tetapi sebaiknya bobot
              dibuat berjumlah 100%.
            </p>
          ) : null}

          {canManage ? (
            <GradeSheet
              classId={classId}
              semesterId={semesterId}
              components={components.map((c) => ({
                id: c.id,
                name: c.name,
                type: c.type,
                typeLabel: GRADE_TYPE_LABEL[c.type as GradeTypeValue] ?? c.type,
                weight: c.weight,
                maxScore: c.maxScore,
              }))}
              students={students.map((s) => ({
                id: s.id,
                fullName: s.fullName,
                nis: s.nis,
              }))}
              initial={initial}
              kkm={kkm}
              action={saveGrades}
            />
          ) : (
            <p className="text-sm text-slate">
              Anda hanya dapat melihat nilai. Hanya guru dan admin yang dapat
              mengisi.
            </p>
          )}
        </>
      )}
    </div>
  );
}
