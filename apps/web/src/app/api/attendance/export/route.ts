import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  listClassStudents,
  listClassAttendanceRange,
} from "@/lib/data/attendance";
import { summarizeAll } from "@/lib/attendance-summary";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_LABEL,
  type AttendanceStatusValue,
} from "@/lib/validations/attendance";

/**
 * Ekspor rekap absensi satu kelas ke CSV.
 * Perlu login & izin baca modul absensi. Isolasi tenant dari sesi.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Belum masuk" }, { status: 401 });
  }
  if (!session.user.schoolId) {
    return NextResponse.json({ error: "Tanpa sekolah" }, { status: 403 });
  }
  if (!can(session.user.role, "attendance", "read", session.user.permissions)) {
    return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });
  }
  const schoolId = session.user.schoolId;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
  }

  // Pastikan kelas milik sekolah ini.
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId, deletedAt: null },
    select: { name: true },
  });
  if (!cls) {
    return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  }

  const [students, records] = await Promise.all([
    listClassStudents(schoolId, classId),
    listClassAttendanceRange(schoolId, classId, from, to),
  ]);

  const summary = summarizeAll(
    records.map((r) => ({
      studentId: r.studentId!,
      status: r.status as AttendanceStatusValue,
    })),
  );

  // Susun CSV. Nilai yang dimulai dengan =,+,-,@ diberi awalan ' agar tidak
  // dieksekusi sebagai formula saat dibuka di Excel (CSV injection).
  const esc = (v: string) => {
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const header = [
    "No",
    "Nama",
    "NIS",
    ...ATTENDANCE_STATUSES.map((s) => ATTENDANCE_LABEL[s]),
    "Total",
    "Kehadiran (%)",
  ];

  const lines = [header.map(esc).join(",")];
  students.forEach((s, i) => {
    const sm = summary.get(s.id);
    const counts = sm?.counts ?? Object.fromEntries(
      ATTENDANCE_STATUSES.map((x) => [x, 0]),
    );
    lines.push(
      [
        String(i + 1),
        s.fullName,
        s.nis ?? "",
        ...ATTENDANCE_STATUSES.map((st) => String(counts[st] ?? 0)),
        String(sm?.total ?? 0),
        String(sm?.attendanceRate ?? 0),
      ]
        .map((v) => esc(v))
        .join(","),
    );
  });

  // BOM agar Excel mengenali UTF-8 dengan benar.
  const csv = "\uFEFF" + lines.join("\r\n");
  const filename = `absensi-${cls.name.replace(/[^\w-]+/g, "_")}-${from}_${to}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
