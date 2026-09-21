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
import {
  computeAll,
  rankStudents,
  summarizeClass,
  toPredicate,
  belowKkm,
} from "@/lib/grade-calc";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { Select } from "@/components/form-fields";
import { GRADE_TYPE_LABEL, type GradeTypeValue } from "@/lib/validations/grade";
import { generateReportCards } from "../actions";
import { GenerateReportButton } from "./report-client";

export const metadata = { title: "Rekap & rapor" };

export default async function ReportPage({
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
    typeof sp.semesterId === "string" ? sp.semesterId : semesters[0]?.id ?? "";

  const subject = subjectId ? await getSubject(schoolId, subjectId) : null;
  const kkm = subject?.kkm ?? 70;

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

  // Susun skor per siswa
  const scoresByStudent = new Map<string, Record<string, number>>();
  for (const g of grades) {
    const rec = scoresByStudent.get(g.studentId) ?? {};
    rec[g.gradeItemId] = g.score;
    scoresByStudent.set(g.studentId, rec);
  }

  const finals = computeAll(
    components.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      weight: c.weight,
      maxScore: c.maxScore,
    })),
    students.map((s) => ({ studentId: s.id, scores: scoresByStudent.get(s.id) ?? {} })),
  );

  const ranks = rankStudents(finals);
  const summary = summarizeClass(finals, kkm);
  const finalById = new Map(finals.map((f) => [f.studentId, f.finalScore]));
  const hasPrereq =
    classes.length > 0 && subjects.length > 0 && effectiveYearId && semesters.length > 0;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap & rapor"
        context={
          subject
            ? `${subject.name} · KKM ${kkm} · ${summary.graded}/${summary.total} siswa bernilai`
            : "Nilai akhir, peringkat, dan draf rapor"
        }
        actions={
          <>
            <Link href="/dashboard/grades/report/students">
              <Button variant="secondary">Rapor per siswa</Button>
            </Link>
            <Link href="/dashboard/grades">
              <Button variant="ghost">Kembali ke input nilai</Button>
            </Link>
          </>
        }
      />

      {!hasPrereq ? (
        <EmptyState
          title="Belum bisa menghitung"
          description="Diperlukan kelas, mapel, tahun ajaran aktif, dan semester."
          action={
            <Link href="/dashboard/academic">
              <Button>Buka Akademik</Button>
            </Link>
          }
        />
      ) : (
        <>
          <form
            action="/dashboard/grades/report"
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
            <div className="w-48">
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
            <div className="w-52">
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
            <div className="w-40">
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

          {/* Ringkasan kelas */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Rata-rata kelas"
              value={summary.average === null ? "—" : String(summary.average)}
            />
            <Stat
              label="Tertinggi"
              value={summary.highest === null ? "—" : String(summary.highest)}
            />
            <Stat
              label="Terendah"
              value={summary.lowest === null ? "—" : String(summary.lowest)}
              warn={summary.lowest !== null && summary.lowest < kkm}
            />
            <Stat
              label={`Di bawah KKM (${kkm})`}
              value={String(summary.remedial)}
              warn={summary.remedial > 0}
            />
          </div>

          {components.length === 0 ? (
            <EmptyState
              title="Belum ada komponen nilai"
              description="Buat komponen nilai untuk mapel ini sebelum menghitung nilai akhir."
              action={
                <Link href="/dashboard/grades/items">
                  <Button>Kelola komponen nilai</Button>
                </Link>
              }
            />
          ) : students.length === 0 ? (
            <EmptyState title="Kelas ini belum punya siswa" description="Tambahkan siswa untuk melihat rekap." />
          ) : (
            <>
              <Table
                head={
                  <>
                    <th className="w-16">Rank</th>
                    <th>Nama siswa</th>
                    {components.map((c) => (
                      <th key={c.id} className="w-20 text-center" title={
                        `${GRADE_TYPE_LABEL[c.type as GradeTypeValue] ?? c.type} · bobot ${c.weight}%`
                      }>
                        {c.name}
                      </th>
                    ))}
                    <th className="w-24 border-l border-chalk text-center">Akhir</th>
                    <th className="w-16 text-center">Predikat</th>
                  </>
                }
              >
                {finals.map((f) => {
                  const st = students.find((s) => s.id === f.studentId)!;
                  const rank = ranks.get(f.studentId) ?? null;
                  const isRemedial =
                    f.finalScore !== null && belowKkm(f.finalScore, kkm);
                  const sc = scoresByStudent.get(f.studentId) ?? {};
                  return (
                    <tr key={f.studentId}>
                      <td className="tabular-display text-base text-slate">
                        {rank ?? "—"}
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/students/${st.id}`}
                          className="text-ink hover:text-board"
                        >
                          {st.fullName}
                        </Link>
                        {st.nis ? (
                          <span className="ml-2 font-mono text-xs text-slate">
                            {st.nis}
                          </span>
                        ) : null}
                      </td>
                      {components.map((c) => {
                        const v = sc[c.id];
                        const low = v !== undefined && belowKkm(v, kkm);
                        return (
                          <td
                            key={c.id}
                            className={`text-center tabular-nums ${
                              low ? "text-marker" : v === undefined ? "text-slate-light" : "text-slate"
                            }`}
                          >
                            {v === undefined ? "—" : v}
                          </td>
                        );
                      })}
                      <td className="border-l border-chalk text-center">
                        <span
                          className={`tabular-display text-lg ${
                            isRemedial ? "text-marker" : "text-board"
                          }`}
                        >
                          {f.finalScore === null ? "—" : f.finalScore}
                        </span>
                      </td>
                      <td className="text-center">
                        {toPredicate(f.finalScore) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </Table>

              {canManage ? (
                <div className="rounded-lg border border-chalk bg-white p-5">
                  <h2 className="card-title">Simpan sebagai draf rapor</h2>
                  <p className="mt-1 max-w-prose text-sm text-slate">
                    Nilai akhir di atas akan disimpan ke rapor siswa untuk semester
                    yang dipilih. Bisa dijalankan ulang bila nilai diubah.
                  </p>
                  <div className="mt-3">
                    <GenerateReportButton
                      classId={classId}
                      subjectId={subjectId}
                      semesterId={semesterId}
                      action={generateReportCards}
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-chalk bg-white p-4">
      <p className="text-xs text-slate">{label}</p>
      <p
        className={`mt-1 tabular-display text-2xl ${warn ? "text-marker" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}
