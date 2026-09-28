import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getClassReportData } from "@/lib/data/grades";
import { computeFinalScore, toPredicate } from "@/lib/grade-calc";
import { SUBJECT_GROUP_LABEL, type SubjectGroupValue } from "@/lib/validations/academic";
import { Button } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/data-table";
import { Select } from "@/components/form-fields";

export const metadata = { title: "Rapor per siswa" };

/**
 * Rapor satu kelas: SETIAP siswa pada SEMUA mapel, dikelompokkan menurut
 * `Subject.group`.
 *
 * ============================================================
 * KENAPA HALAMAN INI ADA, PADAHAL SUDAH ADA "REKAP & RAPOR"
 * ============================================================
 * Halaman Rekap & Rapor bekerja PER SATU MAPEL — bagus untuk guru mapel yang
 * ingin melihat peringkat kelasnya. Tetapi wali kelas butuh hal yang berbeda:
 * seluruh nilai seorang anak dalam satu lembar, tersusun menurut kelompok
 * mapel. Itulah bentuk rapor yang diserahkan ke orang tua.
 *
 * ============================================================
 * KENAPA DIKELOMPOKKAN
 * ============================================================
 * Di SMK, mapel produktif (Pemrograman Web) dan mapel umum (Matematika) tidak
 * setara kedudukannya. Tanpa pengelompokan, keduanya duduk sebaris dan orang
 * tua tidak bisa melihat di mana kompetensi keahlian anak dinilai. Sekolah
 * non-kejuruan hanya melihat satu kelompok "Umum" — halaman tetap masuk akal.
 *
 * Catatan: `SubjectGroup` sengaja memakai istilah netral (UMUM/PEMINATAN/
 * KEJURUAN/MUATAN_LOKAL) supaya melayani SMA dan SMK sekaligus.
 */
export default async function StudentReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "grades", "read", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya akses ke modul penilaian.</p>;
  }

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

  const [classes, semesters] = await Promise.all([
    prisma.class.findMany({
      where: {
        schoolId,
        deletedAt: null,
        ...(academicYearId ? { academicYearId } : {}),
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
      select: { id: true, name: true, level: true },
    }),
    academicYearId
      ? prisma.semester.findMany({
          where: { academicYearId },
          orderBy: { startDate: "asc" },
          select: { id: true, name: true },
        })
      : [],
  ]);

  const classId =
    typeof sp.classId === "string" && sp.classId
      ? sp.classId
      : (classes[0]?.id ?? "");
  const semesterId =
    typeof sp.semesterId === "string" && sp.semesterId
      ? sp.semesterId
      : (semesters[0]?.id ?? "");

  const data =
    classId && semesterId
      ? await getClassReportData(schoolId, { classId, semesterId })
      : null;

  // Kelompokkan mapel; urutan tetap agar antar siswa bisa dibandingkan.
  const GROUP_ORDER: SubjectGroupValue[] = [
    "UMUM",
    "PEMINATAN",
    "KEJURUAN",
    "MUATAN_LOKAL",
  ];

  const subjectsByGroup = new Map<SubjectGroupValue, NonNullable<typeof data>["subjects"]>();
  if (data) {
    for (const g of GROUP_ORDER) {
      const list = data.subjects.filter((s) => (s.group as SubjectGroupValue) === g);
      if (list.length) subjectsByGroup.set(g, list);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapor per siswa"
        context={
          data
            ? `${data.klass.name} · ${data.semester.academicYear.name} ${data.semester.name} · ${data.students.length} siswa`
            : "Nilai semua mapel tiap siswa, dikelompokkan menurut kelompok mapel"
        }
        actions={
          <Link href="/dashboard/grades/report">
            <Button variant="ghost">Rekap per mapel</Button>
          </Link>
        }
      />

      <form
        action="/dashboard/grades/report/students"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
      >
        <div className="w-52">
          <label
            htmlFor="academicYearId"
            className="mb-1 block text-xs font-medium text-slate"
          >
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

        <div className="w-44">
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

        <div className="w-40">
          <label
            htmlFor="semesterId"
            className="mb-1 block text-xs font-medium text-slate"
          >
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

      {!data ? (
        <EmptyState
          title="Belum bisa menampilkan rapor"
          description="Diperlukan kelas dan semester yang punya tahun ajaran aktif. Lengkapi di menu Akademik."
          action={
            <Link href="/dashboard/academic">
              <Button>Buka Akademik</Button>
            </Link>
          }
        />
      ) : data.students.length === 0 ? (
        <EmptyState
          title="Kelas ini belum punya siswa"
          description="Tambahkan siswa ke kelas ini di menu Siswa agar rapornya bisa disusun."
          action={
            <Link href="/dashboard/students">
              <Button>Buka Siswa</Button>
            </Link>
          }
        />
      ) : data.subjects.length === 0 ? (
        <EmptyState
          title="Belum ada mapel dengan komponen nilai"
          description="Rapor membutuhkan komponen nilai (UTS, UAS, Tugas) untuk setiap mapel. Susun dulu di menu Komponen Nilai."
          action={
            <Link href="/dashboard/grades/items">
              <Button>Buka Komponen Nilai</Button>
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate">
            {data.subjects.length} mapel dalam{" "}
            {subjectsByGroup.size} kelompok. Setiap lembar di bawah ini adalah
            satu siswa — siap diserahkan ke orang tua.
          </p>

          <div className="space-y-8">
            {data.students.map((student) => {
              const scores = data.scoresByStudent.get(student.id) ?? {};

              // Nilai akhir per mapel (rumus sama dengan lembar nilai).
              const finals = new Map<string, number | null>();
              for (const subject of data.subjects) {
                const f = computeFinalScore(subject.components, {
                  studentId: student.id,
                  scores,
                });
                finals.set(subject.id, f.finalScore);
              }

              const graded = Array.from(finals.values()).filter(
                (v): v is number => v !== null,
              );
              const average =
                graded.length > 0
                  ? Math.round((graded.reduce((a, b) => a + b, 0) / graded.length) * 10) / 10
                  : null;

              return (
                <section
                  key={student.id}
                  className="border-2 border-[var(--chalk)] bg-white"
                >
                  {/* Kepala rapor */}
                  <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--ink)] px-4 py-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
                        {student.fullName}
                      </h2>
                      <p className="mt-0.5 font-mono text-xs text-[var(--slate)]">
                        NIS {student.nis}
                        {student.nisn ? ` · NISN ${student.nisn}` : ""}
                        {data.klass.major ? ` · ${data.klass.major.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-[var(--slate)]">Rata-rata</p>
                        <p className="tabular-display text-2xl text-[var(--ink)]">
                          {average ?? "—"}
                        </p>
                      </div>
                      {/* Unduh rapor PDF resmi untuk siswa ini.
                          Pratinjau di atas adalah pandangan wali kelas;
                          PDF-nya dokumen yang diserahkan ke orang tua —
                          lengkap dengan kop, tanda tangan, dan catatan. */}
                      <a
                        href={`/api/rapor/${student.id}/${semesterId}`}
                        target="_blank"
                        rel="noopener"
                        className="shrink-0 border-2 border-[var(--ink)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink)] hover:bg-[var(--paper)]"
                      >
                        Unduh PDF
                      </a>
                    </div>
                  </header>

                  {/* Kelompok mapel */}
                  {Array.from(subjectsByGroup.entries()).map(([group, list]) => (
                    <div key={group}>
                      <p className="border-b border-[var(--chalk)] bg-[var(--paper)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
                        Kelompok {SUBJECT_GROUP_LABEL[group] ?? group}
                      </p>
                      <table className="w-full text-sm">
                        <tbody>
                          {list.map((subject) => {
                            const score = finals.get(subject.id) ?? null;
                            const below =
                              score !== null && score < subject.kkm;
                            return (
                              <tr
                                key={subject.id}
                                className="border-b border-[var(--chalk)]/60 last:border-b-0"
                              >
                                <td className="w-20 px-4 py-1.5 font-mono text-xs text-[var(--slate)]">
                                  {subject.code}
                                </td>
                                <td className="px-2 py-1.5 text-[var(--ink)]">
                                  {subject.name}
                                </td>
                                <td className="w-16 px-2 py-1.5 text-right text-xs text-[var(--slate)]">
                                  KKM {subject.kkm}
                                </td>
                                <td className="w-20 px-2 py-1.5 text-right tabular-nums">
                                  {score === null ? (
                                    <span className="text-[var(--slate)]">—</span>
                                  ) : (
                                    <span
                                      className={
                                        below
                                          ? "font-medium text-[var(--marker)]"
                                          : "text-[var(--ink)]"
                                      }
                                      title={below ? "Di bawah KKM" : undefined}
                                    >
                                      {score}
                                    </span>
                                  )}
                                </td>
                                <td className="w-14 px-4 py-1.5 text-right text-xs text-[var(--slate)]">
                                  {toPredicate(score) ?? "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}

                  <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--chalk)] px-4 py-2 text-[11px] text-[var(--slate)]">
                    <span>
                      Wali kelas: {data.klass.homeroomTeacher?.fullName ?? "—"}
                    </span>
                    <span>
                      {graded.length}/{data.subjects.length} mapel bernilai
                    </span>
                  </footer>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
