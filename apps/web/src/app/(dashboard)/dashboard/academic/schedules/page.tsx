import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listSchedules, listTimeSlots, getScheduleStats } from "@/lib/data/schedule";
import { Button } from "@/components/ui";
import { PageHeader, EmptyState } from "@/components/data-table";
import { Select } from "@/components/form-fields";
import { ScheduleGrid } from "./schedule-grid";
import { TeacherScheduleView } from "./teacher-view";

export const metadata = { title: "Jadwal pelajaran" };

export default async function SchedulesPage({
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
  const view = typeof sp.view === "string" ? sp.view : "class";

  // Data referensi
  const [classes, subjects, teachers, slots, stats] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.subject.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.teacher.findMany({
      where: { schoolId, deletedAt: null, isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    listTimeSlots(schoolId),
    getScheduleStats(schoolId),
  ]);

  // ===== Tampilan per guru =====
  if (view === "teacher") {
    const teacherId = typeof sp.teacherId === "string" ? sp.teacherId : teachers[0]?.id;
    const rows = teacherId ? await listSchedules(schoolId, { teacherId }) : [];
    const activeTeacher = teachers.find((t) => t.id === teacherId);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Jadwal pelajaran"
          context={`${stats.total} jadwal · ${stats.classes} kelas · ${stats.slots} jam pelajaran`}
          actions={
            <Link href="/dashboard/academic">
              <Button variant="ghost">Kembali</Button>
            </Link>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded border border-chalk bg-white p-0.5">
            <Link
              href="/dashboard/academic/schedules?view=class"
              className="rounded px-3 py-1.5 text-sm text-slate hover:text-ink"
            >
              Per kelas
            </Link>
            <span className="rounded bg-board px-3 py-1.5 text-sm text-white">
              Per guru
            </span>
          </div>
        </div>

        <form action="/dashboard/academic/schedules" className="flex items-end gap-3">
          <input type="hidden" name="view" value="teacher" />
          <div className="w-72">
            <label htmlFor="teacherId" className="mb-1 block text-xs font-medium text-slate">
              Pilih guru
            </label>
            <Select id="teacherId" name="teacherId" defaultValue={teacherId ?? ""}>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Tampilkan</Button>
        </form>

        {teachers.length === 0 ? (
          <EmptyState
            title="Belum ada guru"
            description="Tambahkan data guru terlebih dahulu untuk menyusun jadwal."
          />
        ) : (
          <TeacherScheduleView
            teacherName={activeTeacher?.fullName ?? ""}
            slots={slots.map((s) => ({
              id: s.id,
              slotNumber: s.slotNumber,
              startTime: s.startTime,
              endTime: s.endTime,
              label: s.label,
            }))}
            entries={rows.map((r) => ({
              id: r.id,
              dayOfWeek: r.dayOfWeek,
              timeSlotId: r.timeSlotId ?? "",
              className: r.class.name,
              subjectName: r.subject.name,
              room: r.room,
            }))}
          />
        )}
      </div>
    );
  }

  // ===== Tampilan per kelas (default) =====
  const classId =
    typeof sp.classId === "string" ? sp.classId : classes[0]?.id ?? "";
  const activeClass = classes.find((c) => c.id === classId);
  const rows = classId ? await listSchedules(schoolId, { classId }) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jadwal pelajaran"
        context={`${stats.total} jadwal · ${stats.classes} kelas · ${stats.slots} jam pelajaran`}
        actions={
          <>
            <Link href="/dashboard/academic/time-slots">
              <Button variant="ghost">Jam pelajaran</Button>
            </Link>
            <Link href="/dashboard/academic">
              <Button variant="ghost">Kembali</Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded border border-chalk bg-white p-0.5">
          <span className="rounded bg-board px-3 py-1.5 text-sm text-white">
            Per kelas
          </span>
          <Link
            href="/dashboard/academic/schedules?view=teacher"
            className="rounded px-3 py-1.5 text-sm text-slate hover:text-ink"
          >
            Per guru
          </Link>
        </div>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          title="Belum ada kelas"
          description="Susun kelas dan tahun ajaran terlebih dahulu, lalu jadwalnya bisa diatur di sini."
          action={
            <Link href="/dashboard/academic/classes">
              <Button>Kelola kelas</Button>
            </Link>
          }
        />
      ) : (
        <>
          <form action="/dashboard/academic/schedules" className="flex items-end gap-3">
            <div className="w-72">
              <label htmlFor="classId" className="mb-1 block text-xs font-medium text-slate">
                Pilih kelas
              </label>
              <Select id="classId" name="classId" defaultValue={classId}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Tampilkan</Button>
          </form>

          <p className="text-sm text-slate">
            Klik sel kosong untuk menambah pelajaran. Sistem menolak jadwal yang
            membuat guru atau kelas bentrok.
            {!canManage ? " Anda hanya dapat melihat." : ""}
          </p>

          <ScheduleGrid
            classId={classId}
            slots={slots.map((s) => ({
              id: s.id,
              slotNumber: s.slotNumber,
              startTime: s.startTime,
              endTime: s.endTime,
              label: s.label,
            }))}
            entries={rows.map((r) => ({
              id: r.id,
              classId: r.classId,
              subjectId: r.subjectId,
              subjectName: r.subject.name,
              teacherId: r.teacherId,
              teacherName: r.teacher.fullName,
              dayOfWeek: r.dayOfWeek,
              timeSlotId: r.timeSlotId ?? "",
              room: r.room,
            }))}
            subjects={subjects}
            teachers={teachers.map((t) => ({ id: t.id, name: t.fullName }))}
          />
          {activeClass ? null : null}
        </>
      )}
    </div>
  );
}
