"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  gradeItemCreateSchema,
  gradeItemUpdateSchema,
  gradeBulkSchema,
} from "@/lib/validations/grade";
import { computeFinalScore, toPredicate, belowKkm } from "@/lib/grade-calc";

/**
 * Server Actions Penilaian.
 *
 * Dua hal yang dijaga ketat:
 *  1. Isolasi tenant — semua referensi (mapel, guru, siswa, kelas) wajib milik
 *     sekolah ini.
 *  2. Skor tidak boleh melebihi nilai maksimal komponen. Ini dicek di server
 *     karena guru bisa salah ketik (mis. 950 alih-alih 95).
 */

/* ============================================================
 * KOMPONEN NILAI
 * ============================================================ */

export async function createGradeItem(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("grades", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = gradeItemCreateSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const d = parsed.data;

  // Validasi referensi milik sekolah ini.
  const [subject, year, teacher] = await Promise.all([
    prisma.subject.findFirst({
      where: { id: d.subjectId, schoolId, deletedAt: null },
      select: { id: true },
    }),
    prisma.academicYear.findFirst({
      where: { id: d.academicYearId, schoolId },
      select: { id: true },
    }),
    prisma.teacher.findFirst({
      where: { id: d.teacherId, schoolId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!subject) return { ok: false, error: "Mata pelajaran tidak ditemukan." };
  if (!year) return { ok: false, error: "Tahun ajaran tidak ditemukan." };
  if (!teacher) return { ok: false, error: "Guru tidak ditemukan." };

  const meta = await requestMeta();
  const created = await prisma.gradeItem.create({
    data: {
      schoolId, // isolasi tenant
      subjectId: d.subjectId,
      academicYearId: d.academicYearId,
      teacherId: d.teacherId,
      name: d.name,
      type: d.type,
      weight: d.weight,
      maxScore: d.maxScore,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "GradeItem",
    entityId: created.id,
    after: { name: d.name, type: d.type, weight: d.weight, maxScore: d.maxScore },
    ...meta,
  });

  revalidatePath("/dashboard/grades");
  return { ok: true, id: created.id, message: "Komponen nilai dibuat." };
}

export async function updateGradeItem(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("grades", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = gradeItemUpdateSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const { id, ...d } = parsed.data;

  const existing = await prisma.gradeItem.findFirst({
    where: { id, schoolId },
  });
  if (!existing) return { ok: false, error: "Komponen nilai tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.gradeItem.update({
    where: { id },
    data: {
      name: d.name,
      type: d.type,
      weight: d.weight,
      maxScore: d.maxScore,
    },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "GradeItem",
    entityId: id,
    before: { name: existing.name, weight: existing.weight },
    after: { name: d.name, weight: d.weight },
    ...meta,
  });

  revalidatePath("/dashboard/grades");
  return { ok: true, id, message: "Komponen nilai disimpan." };
}

export async function deleteGradeItem(id: string): Promise<ActionResult> {
  const g = await guard("grades", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existing = await prisma.gradeItem.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { grades: true } } },
  });
  if (!existing) return { ok: false, error: "Komponen nilai tidak ditemukan." };

  // Menghapus komponen akan menghapus nilainya (cascade) — minta konfirmasi
  // eksplisit lewat pesan yang jelas.
  const affected = existing._count.grades;

  const meta = await requestMeta();
  await prisma.gradeItem.delete({ where: { id } });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "GradeItem",
    entityId: id,
    before: { name: existing.name, nilaiTerhapus: affected },
    ...meta,
  });

  revalidatePath("/dashboard/grades");
  return { ok: true, message: `Komponen dihapus${affected > 0 ? ` beserta ${affected} nilai` : ""}.` };
}

/* ============================================================
 * INPUT NILAI (MASSAL)
 * ============================================================ */

export async function saveGrades(formData: FormData): Promise<ActionResult> {
  const g = await guard("grades", "create");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const rawEntries = formData.get("entries");
  let entries: unknown = [];
  if (typeof rawEntries === "string") {
    try {
      entries = JSON.parse(rawEntries);
    } catch {
      return { ok: false, error: "Data nilai tidak terbaca." };
    }
  }

  const parsed = gradeBulkSchema.safeParse({
    gradeItemId: formData.get("gradeItemId"),
    classId: formData.get("classId"),
    semesterId: formData.get("semesterId"),
    entries,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali data nilai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const { gradeItemId, classId, semesterId, entries: list } = parsed.data;

  // Komponen nilai harus milik sekolah ini.
  const item = await prisma.gradeItem.findFirst({
    where: { id: gradeItemId, schoolId },
    select: { id: true, maxScore: true, subjectId: true, name: true },
  });
  if (!item) return { ok: false, error: "Komponen nilai tidak ditemukan." };

  // Semester harus milik sekolah ini (lewat tahun ajaran).
  const sem = await prisma.semester.findFirst({
    where: { id: semesterId, academicYear: { schoolId } },
    select: { id: true },
  });
  if (!sem) return { ok: false, error: "Semester tidak ditemukan." };

  // Hanya siswa anggota kelas & sekolah ini.
  const studentIds = list.map((e) => e.studentId);
  const valid = await prisma.student.findMany({
    where: { id: { in: studentIds }, schoolId, classId, deletedAt: null },
    select: { id: true },
  });
  const validIds = new Set(valid.map((s) => s.id));
  if (studentIds.some((id) => !validIds.has(id))) {
    return {
      ok: false,
      error: "Ada siswa yang bukan anggota kelas ini. Muat ulang halaman lalu coba lagi.",
    };
  }

  // ==== Cek batas nilai: skor tidak boleh > maxScore ====
  const tooHigh = list.filter(
    (e) => typeof e.score === "number" && e.score > item.maxScore,
  );
  if (tooHigh.length > 0) {
    return {
      ok: false,
      error: `Ada ${tooHigh.length} nilai melebihi batas maksimal (${item.maxScore}).`,
    };
  }

  // Ambil nilai lama untuk mendeteksi siswa yang jadi remedial.
  const previous = await prisma.grade.findMany({
    where: { schoolId, gradeItemId, studentId: { in: studentIds } },
    select: { studentId: true, score: true },
  });
  const prevByStudent = new Map(previous.map((p) => [p.studentId, p.score]));

  const meta = await requestMeta();

  const toRemedial: { studentId: string; score: number }[] = [];

  // KKM diambil SEKALI di luar loop, bukan berulang per siswa.
  const subj = await prisma.subject.findFirst({
    where: { id: item.subjectId, schoolId },
    select: { kkm: true },
  });
  const kkm = subj?.kkm ?? 70;

  await prisma.$transaction(async (tx) => {
    for (const e of list) {
      const hasScore = typeof e.score === "number";
      const prev = prevByStudent.get(e.studentId);

      if (!hasScore) {
        // Nilai dikosongkan → hapus baris bila ada.
        if (prev !== undefined) {
          await tx.grade.deleteMany({
            where: { schoolId, gradeItemId, studentId: e.studentId },
          });
        }
        continue;
      }

      const existing = await tx.grade.findFirst({
        where: { schoolId, gradeItemId, studentId: e.studentId },
        select: { id: true },
      });

      if (existing) {
        await tx.grade.update({
          where: { id: existing.id },
          data: {
            score: e.score as number,
            note: e.note ?? null,
            recordedById: userId,
          },
        });
      } else {
        await tx.grade.create({
          data: {
            schoolId,
            gradeItemId,
            studentId: e.studentId,
            subjectId: item.subjectId,
            classId,
            semesterId,
            score: e.score as number,
            note: e.note ?? null,
            recordedById: userId,
          },
        });
      }

      // Deteksi: sebelumnya aman, sekarang di bawah KKM → beri tahu ortu.
      if (
        belowKkm(e.score as number, kkm) &&
        (prev === undefined || !belowKkm(prev, kkm))
      ) {
        toRemedial.push({ studentId: e.studentId, score: e.score as number });
      }
    }
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "Grade",
    entityId: gradeItemId,
    after: {
      komponen: item.name,
      jumlah: list.filter((e) => typeof e.score === "number").length,
      remedialBaru: toRemedial.length,
    },
    ...meta,
  });

  // Antre pemberitahuan ke orang tua untuk nilai di bawah KKM (via queue).
  if (toRemedial.length > 0) {
    await queueGradeNotifications({
      schoolId,
      gradeItemName: item.name,
      items: toRemedial,
    });
  }

  revalidatePath("/dashboard/grades");
  return {
    ok: true,
    message:
      toRemedial.length > 0
        ? `Nilai tersimpan. ${toRemedial.length} siswa di bawah KKM — pemberitahuan akan dikirim ke orang tua.`
        : "Nilai tersimpan.",
  };
}

/** Antre pemberitahuan nilai di bawah KKM ke orang tua. */
async function queueGradeNotifications(input: {
  schoolId: string;
  gradeItemName: string;
  items: { studentId: string; score: number }[];
}) {
  const { schoolId, gradeItemName, items } = input;

  const students = await prisma.student.findMany({
    where: { id: { in: items.map((i) => i.studentId) }, schoolId },
    select: {
      id: true,
      fullName: true,
      parents: {
        where: { phone: { not: "" } },
        select: { fullName: true, phone: true },
        take: 1,
      },
    },
  });
  const byId = new Map(students.map((s) => [s.id, s]));

  const rows = items
    .map((i) => {
      const st = byId.get(i.studentId);
      const p = st?.parents?.[0];
      if (!st || !p?.phone) return null;

      const body =
        `Assalamualaikum, Bapak/Ibu ${p.fullName}.\n\n` +
        `Kami informasikan bahwa nilai *${gradeItemName}* ananda *${st.fullName}* ` +
        `adalah *${i.score}*, masih di bawah KKM.\n\n` +
        `Ananda akan diikutkan program remedial. Mohon dukungannya di rumah.\n\n` +
        `Terima kasih.`;

      return {
        schoolId,
        channel: "WHATSAPP" as const,
        to: p.phone,
        recipientName: p.fullName,
        templateKey: "GRADE_BELOW_KKM",
        body,
        status: "QUEUED" as const,
        refType: "GRADE",
        refId: i.studentId,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    await prisma.notificationQueue.createMany({ data: rows });
  }
}

/* ============================================================
 * SIMPAN NILAI AKHIR KE RAPOR
 * ============================================================ */

/**
 * Hitung nilai akhir satu kelas untuk satu mapel, lalu simpan ke ReportCard
 * sebagai draf rapor. Bisa dijalankan ulang (idempoten).
 */
export async function generateReportCards(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("grades", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const classId = String(formData.get("classId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const semesterId = String(formData.get("semesterId") ?? "");
  if (!classId || !subjectId || !semesterId) {
    return { ok: false, error: "Kelas, mapel, dan semester wajib dipilih." };
  }

  const [cls, subject, sem] = await Promise.all([
    prisma.class.findFirst({
      where: { id: classId, schoolId, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.subject.findFirst({
      where: { id: subjectId, schoolId, deletedAt: null },
      select: { id: true, name: true, kkm: true },
    }),
    prisma.semester.findFirst({
      where: { id: semesterId, academicYear: { schoolId } },
      select: { id: true },
    }),
  ]);
  if (!cls) return { ok: false, error: "Kelas tidak ditemukan." };
  if (!subject) return { ok: false, error: "Mata pelajaran tidak ditemukan." };
  if (!sem) return { ok: false, error: "Semester tidak ditemukan." };

  // Ambil komponen nilai mapel ini + semua nilainya.
  const items = await prisma.gradeItem.findMany({
    where: { schoolId, subjectId },
    select: { id: true, name: true, type: true, weight: true, maxScore: true },
  });
  if (items.length === 0) {
    return { ok: false, error: "Belum ada komponen nilai untuk mapel ini." };
  }

  const students = await prisma.student.findMany({
    where: { schoolId, classId, deletedAt: null },
    select: { id: true },
  });
  const grades = await prisma.grade.findMany({
    where: { schoolId, subjectId, studentId: { in: students.map((s) => s.id) } },
    select: { gradeItemId: true, studentId: true, score: true },
  });

  // Susun scores per siswa.
  const scoresByStudent = new Map<string, Record<string, number>>();
  for (const gr of grades) {
    const rec = scoresByStudent.get(gr.studentId) ?? {};
    rec[gr.gradeItemId] = gr.score;
    scoresByStudent.set(gr.studentId, rec);
  }

  const meta = await requestMeta();
  let saved = 0;

  await prisma.$transaction(async (tx) => {
    for (const s of students) {
      const final = computeFinalScore(items, {
        studentId: s.id,
        scores: scoresByStudent.get(s.id) ?? {},
      });
      if (final.finalScore === null) continue;

      const score = Math.round(final.finalScore);
      const predicate = toPredicate(final.finalScore);

      await tx.reportCard.upsert({
        where: {
          studentId_semesterId_subjectId: {
            studentId: s.id,
            semesterId,
            subjectId,
          },
        },
        create: {
          schoolId,
          studentId: s.id,
          semesterId,
          subjectId,
          finalScore: score,
          predicate,
        },
        update: { finalScore: score, predicate },
      });
      saved += 1;
    }
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "ReportCard",
    entityId: `${classId}:${subjectId}`,
    after: {
      kelas: cls.name,
      mapel: subject.name,
      semesterId,
      jumlahSiswa: saved,
    },
    ...meta,
  });

  revalidatePath("/dashboard/grades");
  revalidatePath("/dashboard/grades/report");
  return {
    ok: true,
    message: `Nilai akhir disimpan untuk ${saved} siswa.`,
  };
}
