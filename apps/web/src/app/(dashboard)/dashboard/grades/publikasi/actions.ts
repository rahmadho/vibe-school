"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  publishGradesSchema,
  unpublishGradesSchema,
} from "@/lib/validations/grade-publication";

/**
 * Server Actions Publikasi Nilai (Fase 5).
 *
 * Aturan yang dijaga:
 *  - WA TIDAK dikirim di sini. Semua pesan masuk `NotificationQueue`;
 *    worker wa-gateway yang mengirim (AGENTS.md #9).
 *  - Kelas & semester wajib milik sekolah sesi.
 *  - Publikasi dicatat ke AuditLog dan bisa dibatalkan selama belum terkirim.
 */

const REF_TYPE = "GRADE_PUBLICATION";

/**
 * Satu pesan per siswa: mapel + nilai akhir rapor, tanda `*` untuk nilai di
 * bawah KKM mapel itu. `formatDaftarNilai()` hanya menerima SATU KKM, jadi
 * baris disusun di sini memakai KKM masing-masing mapel.
 */
async function antrekanNilai(input: {
  schoolId: string;
  publicationId: string;
  classId: string;
  semesterName: string;
  schoolName: string;
}): Promise<{ studentCount: number; recipientCount: number }> {
  const students = await prisma.student.findMany({
    where: { schoolId: input.schoolId, classId: input.classId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      class: { select: { name: true } },
      parents: {
        select: { fullName: true, phone: true },
        orderBy: { isPrimary: "desc" },
      },
    },
  });
  if (students.length === 0) return { studentCount: 0, recipientCount: 0 };

  const studentIds = students.map((s) => s.id);
  const [cards, subjects] = await Promise.all([
    prisma.reportCard.findMany({
      where: { schoolId: input.schoolId, semesterId: input.publicationId, studentId: { in: studentIds } },
      select: { studentId: true, subjectId: true, finalScore: true },
    }),
    prisma.subject.findMany({
      where: { schoolId: input.schoolId },
      select: { id: true, name: true, kkm: true },
    }),
  ]);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const perStudent = new Map<string, { mapel: string; nilai: number; kkm: number }[]>();
  for (const c of cards) {
    const s = subjectById.get(c.subjectId);
    if (!s) continue;
    const list = perStudent.get(c.studentId) ?? [];
    list.push({ mapel: s.name, nilai: c.finalScore, kkm: s.kkm });
    perStudent.set(c.studentId, list);
  }

  let studentCount = 0;
  let recipientCount = 0;

  for (const st of students) {
    const items = perStudent.get(st.id);
    const parent = st.parents.find((p) => p.phone);
    if (!items || items.length === 0 || !parent) continue;
    studentCount += 1;

    items.sort((a, b) => (a.mapel < b.mapel ? -1 : a.mapel > b.mapel ? 1 : 0));
    const baris = items
      .slice(0, 8)
      .map((i) => `• ${i.mapel} — ${i.nilai}${i.nilai < i.kkm ? " *" : ""}`);
    if (items.length > 8) baris.push(`• dan ${items.length - 8} mapel lain`);

    await prisma.notificationQueue.create({
      data: {
        schoolId: input.schoolId,
        to: parent.phone,
        recipientName: parent.fullName,
        templateKey: "grade.published",
        body: `Assalamualaikum, Bapak/Ibu ${parent.fullName}.

*Nilai semester dibagikan*
${st.fullName} · ${st.class?.name ?? "-"} · ${input.semesterName}

${baris.join("\n")}

Nilai lengkap dan rapor dapat dilihat di portal orang tua.

— ${input.schoolName}`,
        status: "QUEUED",
        priority: 5,
        refType: REF_TYPE,
        refId: input.publicationId,
      },
      select: { id: true },
    });
    recipientCount += 1;
  }

  return { studentCount, recipientCount };
}

/* ============================================================
 * PUBLIKASI
 * ============================================================ */

export async function publishGrades(formData: FormData): Promise<ActionResult> {
  const g = await guard("grades", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = publishGradesSchema.safeParse({
    classId: formData.get("classId"),
    semesterId: formData.get("semesterId"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const { classId, semesterId } = parsed.data;

  const [cls, sem, school] = await Promise.all([
    prisma.class.findFirst({
      where: { id: classId, schoolId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.semester.findFirst({
      where: { id: semesterId, academicYear: { schoolId } },
      select: { id: true, name: true, academicYear: { select: { name: true } } },
    }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
  ]);
  if (!cls) return { ok: false, error: "Kelas tidak ditemukan di sekolah ini." };
  if (!sem) return { ok: false, error: "Semester tidak ditemukan di sekolah ini." };

  const studentIds = (
    await prisma.student.findMany({
      where: { schoolId, classId, deletedAt: null },
      select: { id: true },
    })
  ).map((s) => s.id);
  const raporAda = await prisma.reportCard.count({
    where: { schoolId, semesterId, studentId: { in: studentIds } },
  });
  if (raporAda === 0) {
    return {
      ok: false,
      error:
        "Belum ada rapor untuk kelas & semester ini. Hitung rapor dulu di menu Penilaian → Rekap & Rapor.",
    };
  }

  const existing = await prisma.gradePublication.findUnique({
    where: { classId_semesterId: { classId, semesterId } },
    select: { id: true, status: true },
  });
  if (existing?.status === "PUBLISHED") {
    return { ok: false, error: "Nilai kelas ini untuk semester tersebut sudah dipublikasikan." };
  }

  const publication = await prisma.gradePublication.upsert({
    where: { classId_semesterId: { classId, semesterId } },
    create: { schoolId, classId, semesterId, status: "DRAFT" },
    update: {},
    select: { id: true },
  });

  // Antrean dulu, baru status PUBLISHED: kalau pengantrean gagal, status tidak
  // berbohong bahwa nilai sudah dibagikan.
  const { studentCount, recipientCount } = await antrekanNilai({
    schoolId,
    publicationId: publication.id,
    classId,
    semesterName: `${sem.name} ${sem.academicYear.name}`,
    schoolName: school?.name ?? "",
  });

  await prisma.gradePublication.update({
    where: { id: publication.id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      publishedById: userId,
      studentCount,
      recipientCount,
    },
  });

  const meta = await requestMeta();
  await recordAudit({
    schoolId,
    userId,
    action: existing ? "UPDATE" : "CREATE",
    entity: "GradePublication",
    entityId: publication.id,
    before: existing ? { status: existing.status } : undefined,
    after: {
      status: "PUBLISHED",
      classId,
      className: cls.name,
      semesterId,
      students: studentCount,
      recipients: recipientCount,
    },
    ...meta,
  });

  revalidatePath("/dashboard/grades/publikasi");
  revalidatePath("/portal/nilai");
  return {
    ok: true,
    message: `Nilai ${cls.name} dipublikasikan. ${recipientCount} pesan WhatsApp masuk antrean${
      studentCount > recipientCount ? ` (${studentCount - recipientCount} siswa tanpa nomor wali)` : ""
    }.`,
  };
}

/**
 * Batalkan publikasi: nilai kembali DRAFT (portal menyembunyikan lagi) dan
 * pesan yang MASIH mengantre dibatalkan. Pesan yang sudah terkirim tidak bisa
 * ditarik kembali — hal ini tidak disembunyikan dari admin.
 */
export async function unpublishGrades(formData: FormData): Promise<ActionResult> {
  const g = await guard("grades", "manage");
  if ("fail" in g) return g.fail;
  const schoolId = g.ctx.schoolId;

  const parsed = unpublishGradesSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, error: "Permintaan tidak valid.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const row = await prisma.gradePublication.findFirst({
    where: { id: parsed.data.id, schoolId },
    select: { id: true, status: true, classId: true, semesterId: true },
  });
  if (!row) return { ok: false, error: "Publikasi tidak ditemukan." };
  if (row.status !== "PUBLISHED") return { ok: false, error: "Publikasi ini belum diterbitkan." };

  const cancelled = await prisma.notificationQueue.updateMany({
    where: { schoolId, refType: REF_TYPE, refId: row.id, status: "QUEUED" },
    data: { status: "CANCELLED" },
  });

  await prisma.gradePublication.update({
    where: { id: row.id },
    data: { status: "DRAFT", publishedAt: null, publishedById: null },
  });

  const meta = await requestMeta();
  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "GradePublication",
    entityId: row.id,
    before: { status: "PUBLISHED" },
    after: { status: "DRAFT", cancelledQueue: cancelled.count },
    ...meta,
  });

  revalidatePath("/dashboard/grades/publikasi");
  revalidatePath("/portal/nilai");
  return {
    ok: true,
    message: `Publikasi dibatalkan. ${cancelled.count} pesan yang belum terkirim dibatalkan.`,
  };
}
