import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  listInternships,
  getInternshipSummary,
  getAcademicYearOptions,
  getMajorOptions,
  getStudentOptions,
  getTeacherOptions,
} from "@/lib/data/academic";
import { usesVocationalModules } from "@/lib/major-labels";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { Button, Stat } from "@/components/ui";
import { Select } from "@/components/form-fields";
import {
  INTERNSHIP_STATUSES,
  INTERNSHIP_STATUS_LABEL,
  type InternshipStatusValue,
} from "@/lib/validations/academic";
import { createInternship, updateInternship, deleteInternship } from "../actions";
import { InternshipForm, InternshipRow } from "./internship-client";

export const metadata = { title: "PKL / Prakerin" };

/** Tanggal simpan `@db.Date` → tampilan ringkas untuk kolom tabel. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Daftar penempatan PKL (Praktik Kerja Lapangan).
 *
 * Hanya relevan untuk SMK/MAK. Sekolah non-kejuruan diarahkan kembali ke
 * Akademik — bukan karena dilarang, tetapi karena menu ini tidak muncul di
 * sidebar mereka, sehingga halaman yang terbuka lewat URL langsung akan
 * membingungkan tanpa penjelasan.
 */
export default async function InternshipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "academic", "read", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya akses ke modul akademik.</p>;
  }
  const canManage = can(session.user.role, "academic", "manage", session.user.permissions);

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

  const status = typeof sp.status === "string" ? sp.status : "";
  const majorId = typeof sp.majorId === "string" ? sp.majorId : "";
  const q = typeof sp.q === "string" ? sp.q : "";

  const [rows, summary, majors, students, teachers] = await Promise.all([
    listInternships(schoolId, {
      academicYearId,
      status: status || undefined,
      majorId: majorId || undefined,
      q: q || undefined,
    }),
    getInternshipSummary(schoolId, academicYearId),
    getMajorOptions(schoolId),
    getStudentOptions(schoolId, { academicYearId }),
    getTeacherOptions(schoolId),
  ]);

  if (!usesVocationalModules(school?.level)) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <h1 className="font-display text-2xl text-ink">PKL tidak dipakai di jenjang ini</h1>
        <p className="text-sm text-slate">
          Praktik Kerja Lapangan adalah bagian kurikulum SMK/MAK. Sekolah jenjang{" "}
          {school?.level ?? "ini"} tidak memerlukannya.
        </p>
        <Link href="/dashboard/academic">
          <Button variant="ghost">Kembali ke Akademik</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="PKL / Prakerin"
        context={`${summary.total} penempatan · ${summary.ongoing} berjalan · ${summary.completed} selesai · ${summary.planned} direncanakan`}
        actions={
          <Link href="/dashboard/academic">
            <Button variant="ghost">Kembali</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={summary.total} label="Total penempatan" />
        <Stat value={summary.planned} label="Direncanakan" hint="sudah dapat tempat" />
        <Stat value={summary.ongoing} label="Berjalan" />
        <Stat value={summary.completed} label="Selesai" />
      </div>

      <form
        action="/dashboard/academic/internships"
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

        {majors.length > 0 ? (
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
        ) : null}

        <div className="w-44">
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-slate">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">Semua status</option>
            {INTERNSHIP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INTERNSHIP_STATUS_LABEL[s as InternshipStatusValue]}
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
            placeholder="Nama siswa atau industri"
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          />
        </div>
        <Button type="submit">Terapkan</Button>
      </form>

      {canManage ? (
        <InternshipForm
          mode="create"
          students={students}
          years={years}
          teachers={teachers}
          action={createInternship}
        />
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="Belum ada penempatan PKL"
          description="Catat tempat praktik setiap siswa agar pembimbing, periode, dan nilainya terdokumentasi — bukan hanya diingat."
        />
      ) : (
        <Table
          head={
            <>
              <th>Siswa</th>
              <th>Industri / instansi</th>
              <th className="w-40">Periode</th>
              <th className="w-44">Pembimbing sekolah</th>
              <th className="w-28">Status</th>
              <th className="w-32">Sertifikat</th>
              {canManage ? <th className="w-40 text-right">Aksi</th> : null}
            </>
          }
        >
          {rows.map((r) => (
            <InternshipRow
              key={r.id}
              row={{
                id: r.id,
                studentId: r.student.id,
                academicYearId: r.academicYear.id,
                teacherId: r.teacher?.id ?? null,
                industryName: r.industryName,
                industryAddress: r.industryAddress,
                industryPhone: r.industryPhone,
                supervisorName: r.supervisorName,
                supervisorPhone: r.supervisorPhone,
                startDate: isoDate(r.startDate),
                endDate: isoDate(r.endDate),
                status: r.status,
                score: r.score,
                certificateNo: r.certificateNo,
                note: r.note,
                studentName: r.student.fullName,
                studentNis: r.student.nis,
                className: r.student.class?.name ?? null,
                majorName: r.student.major?.name ?? null,
                yearName: r.academicYear.name,
                teacherName: r.teacher?.fullName ?? null,
              }}
              students={students}
              years={years}
              teachers={teachers}
              updateAction={updateInternship}
              deleteAction={deleteInternship}
            />
          ))}
        </Table>
      )}
    </div>
  );
}
