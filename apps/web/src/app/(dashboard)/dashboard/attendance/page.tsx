import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  listClassStudents,
  getClassAttendance,
  todayIso,
} from "@/lib/data/attendance";
import { Button } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/data-table";
import { Select } from "@/components/form-fields";
import { ATTENDANCE_STATUSES, ATTENDANCE_LABEL } from "@/lib/validations/attendance";
import type { AttendanceStatusValue } from "@/lib/validations/attendance";
import { AttendanceInput } from "./attendance-input";
import { saveClassAttendance } from "./actions";

export const metadata = { title: "Absensi" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const schoolId = session.user.schoolId;
  if (!can(session.user.role, "attendance", "read")) {
    return <p className="text-slate">Anda tidak punya akses ke modul absensi.</p>;
  }
  const canMark = can(session.user.role, "attendance", "create");

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
  const classId = typeof sp.classId === "string" ? sp.classId : classes[0]?.id ?? "";
  const date =
    typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : todayIso();

  const [students, existing] = classId
    ? await Promise.all([
        listClassStudents(schoolId, classId),
        getClassAttendance(schoolId, classId, date),
      ])
    : [[], []];

  // Bentuk peta awal: studentId → status yang sudah tersimpan.
  const initial: Record<string, AttendanceStatusValue> = {};
  for (const e of existing) {
    if (e.studentId) initial[e.studentId] = e.status as AttendanceStatusValue;
  }
  const filled = existing.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Absensi"
        context={`${students.length} siswa · ${filled ? "sudah diisi" : "belum diisi"} untuk tanggal ini`}
        actions={
          <Link href="/dashboard/attendance/summary">
            <Button variant="ghost">Lihat rekap</Button>
          </Link>
        }
      />

      {classes.length === 0 ? (
        <EmptyState
          title="Belum ada kelas"
          description="Buat kelas dan tambahkan siswa terlebih dahulu untuk mengisi absensi."
          action={
            <Link href="/dashboard/academic/classes">
              <Button>Kelola kelas</Button>
            </Link>
          }
        />
      ) : (
        <>
          <form
            action="/dashboard/attendance"
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
            <div className="w-48">
              <label htmlFor="date" className="mb-1 block text-xs font-medium text-slate">
                Tanggal
              </label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={date}
                className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm tabular-nums focus:border-board focus:outline-none"
              />
            </div>
            <Button type="submit">Tampilkan</Button>
            {filled ? (
              <span className="pb-2.5 text-xs text-board">
                Absensi tanggal ini sudah tersimpan — perubahan akan menimpa.
              </span>
            ) : null}
          </form>

          {canMark ? (
            <AttendanceInput
              classId={classId}
              date={date}
              students={students.map((s) => ({
                id: s.id,
                fullName: s.fullName,
                nis: s.nis,
              }))}
              initial={initial}
              action={saveClassAttendance}
            />
          ) : (
            <div className="rounded-lg border border-chalk bg-white p-5">
              <p className="text-sm text-slate">
                Anda hanya dapat melihat absensi. Hanya guru dan admin yang dapat
                mengisi.
              </p>
              {existing.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {existing.map((e) => {
                    const st = students.find((s) => s.id === e.studentId);
                    return (
                      <li key={e.studentId} className="text-slate">
                        {st?.fullName ?? e.studentId} —{" "}
                        {ATTENDANCE_LABEL[e.status as AttendanceStatusValue]}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          )}

          <p className="text-xs text-slate">
            Status: {ATTENDANCE_STATUSES.map((s) => ATTENDANCE_LABEL[s]).join(" · ")}
          </p>
        </>
      )}
    </div>
  );
}
