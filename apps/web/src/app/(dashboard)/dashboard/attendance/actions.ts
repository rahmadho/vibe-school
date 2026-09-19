"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import { attendanceBulkSchema } from "@/lib/validations/attendance";
import { parseDateOnly } from "@/lib/data/attendance";
import { NEEDS_NOTIFICATION } from "@/lib/validations/attendance";

/**
 * Server Actions Absensi.
 *
 * Alur: guru memilih kelas + tanggal → seluruh siswa ditampilkan → status
 * disimpan sekaligus (bulk). Penyimpanan memakai upsert sehingga aman
 * diulang (idempoten) — mengoreksi absen tidak menghasilkan baris ganda.
 *
 * Setiap siswa yang berstatus ALPA/TERLAMBAT dicatat ke NotificationQueue
 * untuk diberitahukan ke orang tua (dikirim worker, BUKAN di sini).
 */

export async function saveClassAttendance(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("attendance", "create");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  // Entri dikirim sebagai JSON agar bisa banyak sekaligus.
  const rawEntries = formData.get("entries");
  let entries: unknown = [];
  if (typeof rawEntries === "string") {
    try {
      entries = JSON.parse(rawEntries);
    } catch {
      return { ok: false, error: "Data absensi tidak terbaca." };
    }
  }

  const parsed = attendanceBulkSchema.safeParse({
    classId: formData.get("classId"),
    date: formData.get("date"),
    scheduleId: formData.get("scheduleId") ?? undefined,
    entries,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali data absensi.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const { classId, date, scheduleId, entries: list } = parsed.data;

  // Pastikan kelas milik sekolah ini.
  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!cls) return { ok: false, error: "Kelas tidak ditemukan." };

  // Pastikan semua siswa yang dikirim memang milik kelas & sekolah ini.
  // Ini mencegah penulisan absensi untuk siswa sekolah lain.
  const studentIds = list.map((e) => e.studentId);
  const valid = await prisma.student.findMany({
    where: { id: { in: studentIds }, schoolId, classId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  const validIds = new Set(valid.map((s) => s.id));
  const nameById = new Map(valid.map((s) => [s.id, s.fullName]));

  const rejected = studentIds.filter((id) => !validIds.has(id));
  if (rejected.length > 0) {
    return {
      ok: false,
      error: `${rejected.length} siswa bukan anggota kelas ini. Muat ulang halaman lalu coba lagi.`,
    };
  }

  const dateValue = parseDateOnly(date);
  const meta = await requestMeta();

  // Absensi disimpan dalam satu transaksi agar konsisten.
  await prisma.$transaction(async (tx) => {
    for (const e of list) {
      // Upsert berdasarkan kunci unik (schoolId, date, studentId) untuk
      // absen harian, atau (schoolId, date, scheduleId, studentId) per-mapel.
      if (scheduleId) {
        const existing = await tx.attendance.findFirst({
          where: {
            schoolId,
            date: dateValue,
            scheduleId,
            studentId: e.studentId,
          },
          select: { id: true },
        });
        if (existing) {
          await tx.attendance.update({
            where: { id: existing.id },
            data: { status: e.status, note: e.note ?? null, markedById: userId },
          });
        } else {
          await tx.attendance.create({
            data: {
              schoolId,
              classId,
              scheduleId,
              studentId: e.studentId,
              date: dateValue,
              status: e.status,
              note: e.note ?? null,
              markedById: userId,
            },
          });
        }
      } else {
        const existing = await tx.attendance.findFirst({
          where: {
            schoolId,
            date: dateValue,
            scheduleId: null,
            studentId: e.studentId,
          },
          select: { id: true },
        });
        if (existing) {
          await tx.attendance.update({
            where: { id: existing.id },
            data: { status: e.status, note: e.note ?? null, markedById: userId },
          });
        } else {
          await tx.attendance.create({
            data: {
              schoolId,
              classId,
              studentId: e.studentId,
              date: dateValue,
              status: e.status,
              note: e.note ?? null,
              markedById: userId,
            },
          });
        }
      }
    }
  });

  // ==== Antre notifikasi ke orang tua untuk status yang perlu diberitahu ====
  // Dikirim worker, bukan di sini (aturan AGENTS.md #9).
  const toNotify = list.filter((e) => NEEDS_NOTIFICATION.includes(e.status));
  if (toNotify.length > 0) {
    await queueParentNotifications({
      schoolId,
      classId,
      className: cls.name,
      dateIso: date,
      items: toNotify.map((e) => ({
        studentId: e.studentId,
        studentName: nameById.get(e.studentId) ?? "Siswa",
        status: e.status,
        note: e.note,
      })),
    });
  }

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "Attendance",
    entityId: classId,
    after: {
      kelas: cls.name,
      tanggal: date,
      jumlah: list.length,
      perMapel: Boolean(scheduleId),
      untukNotifikasi: toNotify.length,
    },
    ...meta,
  });

  revalidatePath("/dashboard/attendance");
  return {
    ok: true,
    message:
      toNotify.length > 0
        ? `Absensi tersimpan. ${toNotify.length} pemberitahuan akan dikirim ke orang tua.`
        : "Absensi tersimpan.",
  };
}

/**
 * Masukkan pemberitahuan absensi ke NotificationQueue.
 * Hanya siswa yang punya akun orang tua dengan nomor WA yang diantrekan.
 */
async function queueParentNotifications(input: {
  schoolId: string;
  classId: string;
  className: string;
  dateIso: string;
  items: {
    studentId: string;
    studentName: string;
    status: string;
    note?: string;
  }[];
}) {
  const { schoolId, className, dateIso, items } = input;

  // Ambil orang tua/wali beserta nomor WA-nya.
  // Catatan: model Parent tidak punya schoolId sendiri — relasinya lewat
  // student. Isolasi tenant dipastikan dengan menyaring student.schoolId.
  const parents = await prisma.parent.findMany({
    where: {
      studentId: { in: items.map((i) => i.studentId) },
      student: { schoolId, deletedAt: null },
      phone: { not: "" },
    },
    select: { studentId: true, fullName: true, phone: true, isPrimary: true },
  });
  const parentByStudent = new Map(parents.map((p) => [p.studentId, p]));

  const rows = items
    .map((i) => {
      const p = parentByStudent.get(i.studentId);
      if (!p?.phone) return null;

      const statusText =
        i.status === "ABSENT"
          ? "tidak hadir tanpa keterangan (alpa)"
          : "terlambat datang";

      const body =
        `Assalamualaikum, Bapak/Ibu ${p.fullName}.\n\n` +
        `Kami informasikan bahwa *${i.studentName}* ${statusText} pada ` +
        `${formatDateId(dateIso)}${i.note ? ` (${i.note})` : ""}.\n\n` +
        `Kelas: ${className}\n\n` +
        `Mohon konfirmasi bila ada keterangan. Terima kasih.`;

      return {
        schoolId,
        channel: "WHATSAPP" as const,
        to: p.phone,
        recipientName: p.fullName,
        templateKey: "ATTENDANCE_ALERT",
        body,
        status: "QUEUED" as const,
        refType: "ATTENDANCE",
        refId: i.studentId,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    await prisma.notificationQueue.createMany({ data: rows });
  }
}

/** Format tanggal Indonesia tanpa dependensi ICU (aman di server). */
function formatDateId(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${d} ${bulan[m - 1]} ${y}`;
}

/** Hapus satu catatan absensi (koreksi bila salah input). */
export async function deleteAttendance(id: string): Promise<ActionResult> {
  const g = await guard("attendance", "delete");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existing = await prisma.attendance.findFirst({
    where: { id, schoolId },
    select: { id: true, studentId: true, status: true },
  });
  if (!existing) return { ok: false, error: "Catatan absensi tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.attendance.delete({ where: { id } });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "Attendance",
    entityId: id,
    before: { studentId: existing.studentId, status: existing.status },
    ...meta,
  });

  revalidatePath("/dashboard/attendance");
  return { ok: true, message: "Catatan absensi dihapus." };
}
