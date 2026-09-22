import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  listClassStudents,
  listClassAttendanceRange,
  parseDateOnly,
} from "@/lib/data/attendance";
import { summarizeAll, needsAttention, defaultRange } from "@/lib/attendance-summary";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { Select } from "@/components/form-fields";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_LABEL,
  ATTENDANCE_CODE,
  type AttendanceStatusValue,
} from "@/lib/validations/attendance";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Rekap absensi" };

export default async function AttendanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "attendance", "read", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya akses ke modul absensi.</p>;
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

  const classes = await prisma.class.findMany({
    where: {
      schoolId,
      deletedAt: null,
      ...(academicYearId ? { academicYearId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const range = defaultRange();
  const classId = typeof sp.classId === "string" ? sp.classId : classes[0]?.id ?? "";
  const from =
    typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)
      ? sp.from
      : range.from;
  const to =
    typeof sp.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)
      ? sp.to
      : range.to;

  const [students, records] = classId
    ? await Promise.all([
        listClassStudents(schoolId, classId),
        listClassAttendanceRange(schoolId, classId, from, to),
      ])
    : [[], []];

  const summary = summarizeAll(
    records.map((r) => ({
      studentId: r.studentId!,
      status: r.status as AttendanceStatusValue,
    })),
  );

  // Hari efektif = jumlah tanggal unik yang punya catatan absensi.
  const uniqueDays = new Set(records.map((r) => parseDateOnly(toDateKey(r.date)).getTime()))
    .size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap absensi"
        context={`${uniqueDays} hari tercatat · ${records.length} catatan`}
        actions={
          <>
            <Link href="/dashboard/attendance">
              <Button variant="ghost">Isi absensi</Button>
            </Link>
            <Link
              href={`/api/attendance/export?classId=${classId}&from=${from}&to=${to}`}
            >
              <Button variant="secondary">Unduh CSV</Button>
            </Link>
          </>
        }
      />

      <form
        action="/dashboard/attendance/summary"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
      >
        <div className="w-56">
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
        <div className="w-56">
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
        <div className="w-44">
          <label htmlFor="from" className="mb-1 block text-xs font-medium text-slate">
            Dari
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="h-10 w-full rounded border border-chalk px-3 text-sm tabular-nums focus:border-board focus:outline-none"
          />
        </div>
        <div className="w-44">
          <label htmlFor="to" className="mb-1 block text-xs font-medium text-slate">
            Sampai
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="h-10 w-full rounded border border-chalk px-3 text-sm tabular-nums focus:border-board focus:outline-none"
          />
        </div>
        <Button type="submit">Terapkan</Button>
      </form>

      {classes.length === 0 ? (
        <EmptyState
          title="Belum ada kelas"
          description="Rekap absensi muncul setelah kelas dan siswa tersedia."
        />
      ) : students.length === 0 ? (
        <EmptyState
          title="Kelas ini belum punya siswa"
          description="Tambahkan siswa ke kelas untuk melihat rekap absensinya."
        />
      ) : (
        <Table
          head={
            <>
              <th className="w-12">No</th>
              <th>Nama siswa</th>
              {ATTENDANCE_STATUSES.map((s) => (
                <th key={s} className="w-16 text-center" title={ATTENDANCE_LABEL[s]}>
                  {ATTENDANCE_CODE[s]}
                </th>
              ))}
              <th className="w-24 text-right">Kehadiran</th>
            </>
          }
        >
          {students.map((s, i) => {
            const sm = summary.get(s.id);
            const counts =
              sm?.counts ??
              (Object.fromEntries(ATTENDANCE_STATUSES.map((x) => [x, 0])) as Record<
                AttendanceStatusValue,
                number
              >);
            const rate = sm?.attendanceRate ?? 0;
            const warn = sm ? needsAttention(sm) : false;
            return (
              <tr key={s.id}>
                <td className="tabular-nums text-slate">{i + 1}</td>
                <td>
                  <Link
                    href={`/dashboard/students/${s.id}`}
                    className="text-ink hover:text-board"
                  >
                    {s.fullName}
                  </Link>
                  {s.nis ? (
                    <span className="ml-2 font-mono text-xs text-slate">{s.nis}</span>
                  ) : null}
                  {warn ? (
                    <span
                      className="ml-2 inline-flex items-center gap-1 text-xs text-marker"
                      title="Kehadiran di bawah 80% — perlu perhatian"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-marker" />
                      perhatian
                    </span>
                  ) : null}
                </td>
                {ATTENDANCE_STATUSES.map((st) => (
                  <td
                    key={st}
                    className={`text-center tabular-nums ${
                      st === "ABSENT" && counts[st] > 0
                        ? "text-marker"
                        : "text-slate"
                    }`}
                  >
                    {counts[st]}
                  </td>
                ))}
                <td className="text-right">
                  <span
                    className={`tabular-display text-lg ${
                      warn ? "text-marker" : "text-board"
                    }`}
                  >
                    {rate}%
                  </span>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <p className="text-xs text-slate">
        H = Hadir · T = Terlambat · S = Sakit · I = Izin · A = Alpa. Persentase
        kehadiran menghitung hadir dan terlambat. Rentang: {formatDate(from)} –{" "}
        {formatDate(to)}.
      </p>
    </div>
  );
}

/** Kunci tanggal (YYYY-MM-DD) dari kolom DATE. */
function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}
