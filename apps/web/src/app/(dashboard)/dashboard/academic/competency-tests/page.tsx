import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  listCompetencyTests,
  getCompetencySummary,
  getAcademicYearOptions,
  getMajorOptions,
  getStudentOptions,
} from "@/lib/data/academic";
import { usesVocationalModules } from "@/lib/major-labels";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { Button, Stat } from "@/components/ui";
import { Select } from "@/components/form-fields";
import {
  COMPETENCY_RESULTS,
  COMPETENCY_RESULT_LABEL,
  type CompetencyResultValue,
} from "@/lib/validations/academic";
import {
  createCompetencyTest,
  updateCompetencyTest,
  deleteCompetencyTest,
} from "../actions";
import { CompetencyForm, CompetencyRow } from "./competency-client";

export const metadata = { title: "Uji Kompetensi Keahlian" };

/** Tanggal `@db.Date` → string YYYY-MM-DD untuk input & tabel. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Daftar hasil UKK (Uji Kompetensi Keahlian).
 *
 * Menyimpan hasil, penguji, dan nomor sertifikat per siswa. Hanya relevan
 * untuk SMK/MAK — jenjang lain diarahkan kembali dengan penjelasan.
 */
export default async function CompetencyTestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "academic", "read")) {
    return <p className="text-slate">Anda tidak punya akses ke modul akademik.</p>;
  }
  const canManage = can(session.user.role, "academic", "manage");

  const sp = await searchParams;
  const years = await getAcademicYearOptions(schoolId);
  const activeYear = years.find((y) => y.isActive);

  let academicYearId: string | undefined;
  if (sp.academicYearId === "all") {
    academicYearId = undefined;
  } else if (typeof sp.academicYearId === "string" && sp.academicYearId.length > 0) {
    academicYearId = sp.academicYearId;
  } else {
    academicYearId = activeYear?.id;
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { level: true },
  });

  const result = typeof sp.result === "string" ? sp.result : "";
  const majorId = typeof sp.majorId === "string" ? sp.majorId : "";
  const q = typeof sp.q === "string" ? sp.q : "";

  const [rows, summary, majors, students] = await Promise.all([
    listCompetencyTests(schoolId, {
      academicYearId,
      result: result || undefined,
      majorId: majorId || undefined,
      q: q || undefined,
    }),
    getCompetencySummary(schoolId, academicYearId),
    getMajorOptions(schoolId),
    getStudentOptions(schoolId, { academicYearId }),
  ]);

  if (!usesVocationalModules(school?.level)) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <h1 className="font-display text-2xl text-ink">
          UKK tidak dipakai di jenjang ini
        </h1>
        <p className="text-sm text-slate">
          Uji Kompetensi Keahlian adalah penutup masa studi SMK/MAK. Sekolah
          jenjang {school?.level ?? "ini"} tidak memerlukannya.
        </p>
        <Link href="/dashboard/academic">
          <Button variant="ghost">Kembali ke Akademik</Button>
        </Link>
      </div>
    );
  }

  const passRate =
    summary.total > 0 ? Math.round((summary.competent / summary.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Uji Kompetensi Keahlian"
        context={`${summary.total} hasil uji · ${summary.competent} kompeten · ${summary.notCompetent} belum kompeten`}
        actions={
          <Link href="/dashboard/academic">
            <Button variant="ghost">Kembali</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat value={summary.total} label="Total diuji" />
        <Stat value={summary.competent} label="Kompeten" hint={`${passRate}% kelulusan`} />
        <Stat value={summary.notCompetent} label="Belum kompeten" />
      </div>

      <form
        action="/dashboard/academic/competency-tests"
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

        <div className="w-52">
          <label htmlFor="majorId" className="mb-1 block text-xs font-medium text-slate">
            Jurusan
          </label>
          <Select id="majorId" name="majorId" defaultValue={majorId}>
            <option value="">Semua jurusan</option>
            {majors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-48">
          <label htmlFor="result" className="mb-1 block text-xs font-medium text-slate">
            Hasil
          </label>
          <Select id="result" name="result" defaultValue={result}>
            <option value="">Semua hasil</option>
            {COMPETENCY_RESULTS.map((r) => (
              <option key={r} value={r}>
                {COMPETENCY_RESULT_LABEL[r as CompetencyResultValue]}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[180px] flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate">
            Cari
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Nama siswa, penguji, atau no. sertifikat"
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          />
        </div>
        <Button type="submit">Terapkan</Button>
      </form>

      {canManage && majors.length > 0 ? (
        <CompetencyForm
          mode="create"
          students={students}
          years={years}
          majors={majors}
          action={createCompetencyTest}
        />
      ) : null}

      {majors.length === 0 ? (
        <EmptyState
          title="Belum ada jurusan"
          description="UKK menguji kompetensi jurusan siswa. Tambahkan jurusan terlebih dahulu di menu Jurusan."
          action={
            <Link href="/dashboard/academic/majors">
              <Button>Buka Jurusan</Button>
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Belum ada hasil UKK"
          description="Catat hasil uji, penguji, dan nomor sertifikat. Sertifikat ini dibawa lulusan saat melamar kerja."
        />
      ) : (
        <Table
          head={
            <>
              <th>Siswa</th>
              <th className="w-48">Jurusan</th>
              <th>Penguji</th>
              <th className="w-28">Tanggal</th>
              <th className="w-28">Hasil</th>
              <th className="w-32">Sertifikat</th>
              {canManage ? <th className="w-40 text-right">Aksi</th> : null}
            </>
          }
        >
          {rows.map((r) => (
            <CompetencyRow
              key={r.id}
              row={{
                id: r.id,
                studentId: r.student.id,
                academicYearId: r.academicYear.id,
                majorId: r.major.id,
                examinerName: r.examinerName,
                examinerOrg: r.examinerOrg,
                testDate: isoDate(r.testDate),
                result: r.result,
                score: r.score,
                certificateNo: r.certificateNo,
                note: r.note,
                studentName: r.student.fullName,
                studentNis: r.student.nis,
                className: r.student.class?.name ?? null,
                majorName: r.major.name,
              }}
              students={students}
              years={years}
              majors={majors}
              updateAction={updateCompetencyTest}
              deleteAction={deleteCompetencyTest}
            />
          ))}
        </Table>
      )}
    </div>
  );
}
