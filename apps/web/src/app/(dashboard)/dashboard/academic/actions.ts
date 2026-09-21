"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  academicYearCreateSchema,
  classCreateSchema,
  classUpdateSchema,
  subjectCreateSchema,
  subjectUpdateSchema,
  bulkProgressionSchema,
  majorCreateSchema,
  majorUpdateSchema,
  internshipCreateSchema,
  internshipUpdateSchema,
  competencyTestCreateSchema,
  competencyTestUpdateSchema,
} from "@/lib/validations/academic";
/* ============================================================
 * TAHUN AJARAN
 * ============================================================ */
export async function createAcademicYear(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = academicYearCreateSchema.safeParse(
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

  const dup = await prisma.academicYear.findFirst({
    where: { schoolId, name: d.name },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: "Tahun ajaran ini sudah ada.",
      fieldErrors: { name: ["Sudah terdaftar"] },
    };
  }

  const meta = await requestMeta();
  const created = await prisma.academicYear.create({
    data: {
      schoolId,
      name: d.name,
      startDate: d.startDate,
      endDate: d.endDate,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "AcademicYear",
    entityId: created.id,
    after: { name: d.name },
    ...meta,
  });

  revalidatePath("/dashboard/academic/years");
  return { ok: true, id: created.id, message: "Tahun ajaran dibuat." };
}

/** Aktifkan satu tahun ajaran (menonaktifkan yang lain). */
export async function activateAcademicYear(id: string): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const target = await prisma.academicYear.findFirst({
    where: { id, schoolId },
    select: { id: true, name: true },
  });
  if (!target) return { ok: false, error: "Tahun ajaran tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.$transaction([
    prisma.academicYear.updateMany({
      where: { schoolId, isActive: true },
      data: { isActive: false },
    }),
    prisma.academicYear.update({
      where: { id },
      data: { isActive: true },
    }),
  ]);

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "AcademicYear",
    entityId: id,
    after: { isActive: true, name: target.name },
    ...meta,
  });

  revalidatePath("/dashboard/academic/years");
  return { ok: true, message: `${target.name} diaktifkan.` };
}

export async function deleteAcademicYear(id: string): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const target = await prisma.academicYear.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { classes: true } } },
  });
  if (!target) return { ok: false, error: "Tahun ajaran tidak ditemukan." };
  if (target._count.classes > 0) {
    return {
      ok: false,
      error: `Tidak bisa dihapus: masih ada ${target._count.classes} kelas terkait.`,
    };
  }

  const meta = await requestMeta();
  await prisma.academicYear.delete({ where: { id } });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "AcademicYear",
    entityId: id,
    before: { name: target.name },
    ...meta,
  });

  revalidatePath("/dashboard/academic/years");
  return { ok: true, message: "Tahun ajaran dihapus." };
}

/* ============================================================
 * KELAS
 * ============================================================ */
export async function createClass(formData: FormData): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = classCreateSchema.safeParse(
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

  // Tahun ajaran & wali kelas harus milik sekolah ini.
  const ay = await prisma.academicYear.findFirst({
    where: { id: d.academicYearId, schoolId },
    select: { id: true },
  });
  if (!ay) {
    return {
      ok: false,
      error: "Tahun ajaran tidak valid.",
      fieldErrors: { academicYearId: ["Pilih tahun ajaran yang benar"] },
    };
  }
  if (d.homeroomTeacherId) {
    const t = await prisma.teacher.findFirst({
      where: { id: d.homeroomTeacherId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!t) {
      return {
        ok: false,
        error: "Wali kelas tidak valid.",
        fieldErrors: { homeroomTeacherId: ["Guru tidak ditemukan"] },
      };
    }
  }

  const dup = await prisma.class.findFirst({
    where: { schoolId, academicYearId: d.academicYearId, name: d.name },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: "Kelas dengan nama ini sudah ada di tahun ajaran tersebut.",
      fieldErrors: { name: ["Nama kelas sudah dipakai"] },
    };
  }

  const meta = await requestMeta();
  const created = await prisma.class.create({
    data: {
      schoolId,
      academicYearId: d.academicYearId,
      name: d.name,
      level: d.level,
      capacity: d.capacity,
      homeroomTeacherId: d.homeroomTeacherId ?? null,
      majorId: d.majorId ?? null,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "Class",
    entityId: created.id,
    after: { name: d.name, level: d.level },
    ...meta,
  });

  revalidatePath("/dashboard/academic/classes");
  return { ok: true, id: created.id, message: "Kelas dibuat." };
}

export async function updateClass(formData: FormData): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = classUpdateSchema.safeParse(
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

  const existing = await prisma.class.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Kelas tidak ditemukan." };

  const dup = await prisma.class.findFirst({
    where: {
      schoolId,
      academicYearId: d.academicYearId,
      name: d.name,
      id: { not: id },
    },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: "Nama kelas sudah dipakai di tahun ajaran tersebut.",
      fieldErrors: { name: ["Nama kelas sudah dipakai"] },
    };
  }

  const meta = await requestMeta();
  await prisma.class.update({
    where: { id },
    data: {
      academicYearId: d.academicYearId,
      name: d.name,
      level: d.level,
      capacity: d.capacity,
      homeroomTeacherId: d.homeroomTeacherId ?? null,
      majorId: d.majorId ?? null,
    },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "Class",
    entityId: id,
    before: { name: existing.name },
    after: { name: d.name },
    ...meta,
  });

  revalidatePath("/dashboard/academic/classes");
  revalidatePath(`/dashboard/academic/classes/${id}`);
  return { ok: true, id, message: "Kelas disimpan." };
}

export async function softDeleteClass(id: string): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existing = await prisma.class.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: { _count: { select: { students: true } } },
  });
  if (!existing) return { ok: false, error: "Kelas tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.class.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "Class",
    entityId: id,
    before: { name: existing.name, students: existing._count.students },
    ...meta,
  });

  revalidatePath("/dashboard/academic/classes");
  return {
    ok: true,
    message:
      existing._count.students > 0
        ? "Kelas diarsipkan. Siswa tetap tersimpan."
        : "Kelas dihapus.",
  };
}

/* ============================================================
 * MAPEL
 * ============================================================ */
export async function createSubject(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = subjectCreateSchema.safeParse(
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

  const dup = await prisma.subject.findFirst({
    where: { schoolId, code: d.code },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: "Kode mapel sudah dipakai.",
      fieldErrors: { code: ["Kode sudah dipakai"] },
    };
  }

  const meta = await requestMeta();
  const created = await prisma.subject.create({
    data: {
      schoolId,
      code: d.code,
      name: d.name,
      kkm: d.kkm,
      group: d.group,
      majorId: d.majorId ?? null,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "Subject",
    entityId: created.id,
    after: { code: d.code, name: d.name },
    ...meta,
  });

  revalidatePath("/dashboard/academic/subjects");
  return { ok: true, id: created.id, message: "Mata pelajaran dibuat." };
}

export async function updateSubject(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = subjectUpdateSchema.safeParse(
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

  const existing = await prisma.subject.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Mapel tidak ditemukan." };

  const dup = await prisma.subject.findFirst({
    where: { schoolId, code: d.code, id: { not: id } },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: "Kode mapel sudah dipakai.",
      fieldErrors: { code: ["Kode sudah dipakai"] },
    };
  }

  const meta = await requestMeta();
  await prisma.subject.update({
    where: { id },
    data: {
      code: d.code,
      name: d.name,
      kkm: d.kkm,
      group: d.group,
      majorId: d.majorId ?? null,
    },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "Subject",
    entityId: id,
    before: { code: existing.code, name: existing.name },
    after: { code: d.code, name: d.name },
    ...meta,
  });

  revalidatePath("/dashboard/academic/subjects");
  return { ok: true, id, message: "Mapel disimpan." };
}

export async function softDeleteSubject(id: string): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existing = await prisma.subject.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Mapel tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.subject.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "Subject",
    entityId: id,
    before: { code: existing.code, name: existing.name },
    ...meta,
  });

  revalidatePath("/dashboard/academic/subjects");
  return { ok: true, message: "Mapel dihapus." };
}

/* ============================================================
 * KENAIKAN KELAS MASSAL (Fase 9)
 * ============================================================ */
export async function executeBulkProgression(rawInput: unknown): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = bulkProgressionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Data kenaikan kelas tidak lengkap atau tidak valid.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { sourceClassId, sourceAcademicYearId, targetAcademicYearId, items } = parsed.data;

  // Verifikasi kelas asal & tahun ajaran milik tenant
  const [sourceClass, sourceYear, targetYear] = await Promise.all([
    prisma.class.findFirst({
      where: { id: sourceClassId, schoolId, deletedAt: null },
      select: { id: true, name: true, level: true },
    }),
    prisma.academicYear.findFirst({
      where: { id: sourceAcademicYearId, schoolId },
      select: { id: true, name: true },
    }),
    prisma.academicYear.findFirst({
      where: { id: targetAcademicYearId, schoolId },
      select: { id: true, name: true },
    }),
  ]);

  if (!sourceClass) return { ok: false, error: "Kelas asal tidak ditemukan." };
  if (!sourceYear) return { ok: false, error: "Tahun ajaran asal tidak ditemukan." };
  if (!targetYear) return { ok: false, error: "Tahun ajaran tujuan tidak ditemukan." };

  // Validasi ID siswa: semua harus milik tenant dan sedang di kelas asal
  const studentIds = items.map((i) => i.studentId);
  const studentsInClass = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      schoolId,
      deletedAt: null,
    },
    select: { id: true, fullName: true, classId: true, status: true },
  });

  if (studentsInClass.length !== studentIds.length) {
    return { ok: false, error: "Sebagian siswa tidak valid atau bukan milik sekolah ini." };
  }

  // Kumpulkan kelas tujuan yang dibutuhkan (untuk NAIK / TINGGAL)
  const targetClassIds = Array.from(
    new Set(
      items
        .filter((i) => i.result === "NAIK" || i.result === "TINGGAL")
        .map((i) => i.targetClassId)
        .filter((cid): cid is string => Boolean(cid)),
    ),
  );

  /**
   * Peta kelas tujuan → jurusan. Dipakai menyinkronkan `Student.majorId` saat
   * siswa berpindah kelas. Tanpa ini, siswa pindah ke kelas RPL tetapi
   * jurusannya tetap TKJ, dan rekap per jurusan (PKL, UKK, rapor) jadi salah.
   */
  const targetMajorMap = new Map<string, string | null>();

  if (targetClassIds.length > 0) {
    const validTargetClasses = await prisma.class.findMany({
      where: {
        id: { in: targetClassIds },
        schoolId,
        deletedAt: null,
      },
      select: { id: true, name: true, level: true, majorId: true },
    });
    if (validTargetClasses.length !== targetClassIds.length) {
      return { ok: false, error: "Sebagian kelas tujuan tidak ditemukan di sekolah ini." };
    }

    // ATURAN: Kelas tujuan tidak boleh di bawah tingkat kelas asal
    const targetMap = new Map(validTargetClasses.map((c) => [c.id, c.level]));
    for (const [id, majorId] of validTargetClasses.map(
      (c) => [c.id, c.majorId] as const,
    )) {
      targetMajorMap.set(id, majorId);
    }
    for (const item of items) {
      if (item.targetClassId) {
        const targetLevel = targetMap.get(item.targetClassId);
        if (targetLevel !== undefined) {
          if (item.result === "NAIK" && targetLevel <= sourceClass.level) {
            return {
              ok: false,
              error: `Siswa yang naik kelas harus menuju ke kelas dengan tingkat lebih tinggi dari tingkat ${sourceClass.level}.`,
            };
          }
          if (item.result === "TINGGAL" && targetLevel !== sourceClass.level) {
            return {
              ok: false,
              error: `Siswa yang tinggal kelas harus tetap di kelas dengan tingkat ${sourceClass.level}.`,
            };
          }
        }
      }
    }
  }

  const meta = await requestMeta();

  // Eksekusi atomik
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      // 1. Catat riwayat kelas
      await tx.studentClassHistory.create({
        data: {
          schoolId,
          studentId: item.studentId,
          classId: sourceClassId,
          academicYearId: sourceAcademicYearId,
          result: item.result,
          note: item.note ?? null,
        },
      });

      // 2. Mutasi status & kelas pada siswa
      if (item.result === "LULUS") {
        await tx.student.update({
          where: { id: item.studentId },
          data: {
            classId: null,
            status: "GRADUATED",
          },
        });
      } else if (item.result === "MUTASI") {
        await tx.student.update({
          where: { id: item.studentId },
          data: {
            classId: null,
            status: "TRANSFERRED",
          },
        });
      } else {
        // NAIK atau TINGGAL: update ke targetClassId
        if (!item.targetClassId) {
          throw new Error(`Kelas tujuan wajib dipilih untuk siswa yang berstatus ${item.result}.`);
        }
        await tx.student.update({
          where: { id: item.studentId },
          data: {
            classId: item.targetClassId,
            status: "ACTIVE",
            // Jurusan mengikuti kelas tujuan. `undefined` (kelas tanpa jurusan)
            // sengaja TIDAK menimpa jurusan siswa — kelas umum di sekolah
            // berjurusan bukan alasan menghapus data jurusan siswa.
            ...(targetMajorMap.get(item.targetClassId)
              ? { majorId: targetMajorMap.get(item.targetClassId) }
              : {}),
          },
        });
      }
    }

    // 3. Catat audit log transaksi massal
    await recordAudit({
      schoolId,
      userId,
      action: "UPDATE",
      entity: "StudentClassHistory",
      entityId: sourceClassId,
      after: {
        sourceClass: sourceClass.name,
        sourceYear: sourceYear.name,
        targetYear: targetYear.name,
        processedCount: items.length,
      },
      ...meta,
    });
  });

  revalidatePath("/dashboard/academic/classes");
  revalidatePath("/dashboard/academic/progression");
  revalidatePath("/dashboard/students");

  return {
    ok: true,
    message: `Berhasil memproses status kenaikan ${items.length} siswa kelas ${sourceClass.name}.`,
  };
}

/* ============================================================
 * JURUSAN / PEMINATAN
 * ============================================================ */
export async function createMajor(formData: FormData): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = majorCreateSchema.safeParse(
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

  // Ketua program harus guru milik sekolah ini (bila diisi).
  if (d.headTeacherId) {
    const t = await prisma.teacher.findFirst({
      where: { id: d.headTeacherId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!t) {
      return {
        ok: false,
        error: "Ketua program tidak valid.",
        fieldErrors: { headTeacherId: ["Guru tidak ditemukan"] },
      };
    }
  }

  // Kode harus unik per sekolah. Kode sama dari sekolah lain tidak masalah
  // karena isolasi tenant sudah memisahkan datanya.
  const dup = await prisma.major.findFirst({
    where: { schoolId, code: d.code, deletedAt: null },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: "Kode sudah dipakai.",
      fieldErrors: { code: ["Kode sudah dipakai"] },
    };
  }

  const meta = await requestMeta();
  const created = await prisma.major.create({
    data: {
      schoolId,
      code: d.code,
      name: d.name,
      description: d.description ?? null,
      headTeacherId: d.headTeacherId ?? null,
      isActive: d.isActive,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "Major",
    entityId: created.id,
    after: { code: d.code, name: d.name },
    ...meta,
  });

  revalidatePath("/dashboard/academic/majors");
  return { ok: true, id: created.id, message: "Jurusan dibuat." };
}

export async function updateMajor(formData: FormData): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = majorUpdateSchema.safeParse(
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

  const existing = await prisma.major.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Jurusan tidak ditemukan." };

  if (d.headTeacherId) {
    const t = await prisma.teacher.findFirst({
      where: { id: d.headTeacherId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!t) {
      return {
        ok: false,
        error: "Ketua program tidak valid.",
        fieldErrors: { headTeacherId: ["Guru tidak ditemukan"] },
      };
    }
  }

  const dup = await prisma.major.findFirst({
    where: { schoolId, code: d.code, deletedAt: null, id: { not: id } },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: "Kode sudah dipakai.",
      fieldErrors: { code: ["Kode sudah dipakai"] },
    };
  }

  const meta = await requestMeta();
  await prisma.major.update({
    where: { id },
    data: {
      code: d.code,
      name: d.name,
      description: d.description ?? null,
      headTeacherId: d.headTeacherId ?? null,
      isActive: d.isActive,
    },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "Major",
    entityId: id,
    before: { code: existing.code, name: existing.name },
    after: { code: d.code, name: d.name },
    ...meta,
  });

  revalidatePath("/dashboard/academic/majors");
  return { ok: true, id, message: "Jurusan disimpan." };
}

/**
 * Arsipkan jurusan.
 *
 * Ditahan bila masih dipakai kelas/siswa aktif: mengarsipkannya diam-diam
 * akan membuat rapor dan rekap kehilangan konteks jurusan. Operator harus
 * memindahkan penghuninya lebih dulu.
 */
export async function softDeleteMajor(id: string): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existing = await prisma.major.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: {
      _count: {
        select: {
          classes: { where: { deletedAt: null } },
          students: { where: { deletedAt: null } },
          subjects: { where: { deletedAt: null } },
        },
      },
    },
  });
  if (!existing) return { ok: false, error: "Jurusan tidak ditemukan." };

  const { classes, students, subjects } = existing._count;
  if (classes > 0 || students > 0 || subjects > 0) {
    return {
      ok: false,
      error:
        `Jurusan masih dipakai ${classes} kelas, ${students} siswa, dan ` +
        `${subjects} mapel. Pindahkan atau hapus dulu sebelum mengarsipkan.`,
    };
  }

  const meta = await requestMeta();
  await prisma.major.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "Major",
    entityId: id,
    before: { code: existing.code, name: existing.name },
    ...meta,
  });

  revalidatePath("/dashboard/academic/majors");
  return { ok: true, message: "Jurusan diarsipkan." };
}

/* ============================================================
 * PKL / PRAKERIN
 * ============================================================ */
export async function createInternship(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = internshipCreateSchema.safeParse(
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

  const [student, year] = await Promise.all([
    prisma.student.findFirst({
      where: { id: d.studentId, schoolId, deletedAt: null },
      select: { id: true, fullName: true },
    }),
    prisma.academicYear.findFirst({
      where: { id: d.academicYearId, schoolId },
      select: { id: true },
    }),
  ]);
  if (!student) {
    return {
      ok: false,
      error: "Siswa tidak valid.",
      fieldErrors: { studentId: ["Siswa tidak ditemukan"] },
    };
  }
  if (!year) {
    return {
      ok: false,
      error: "Tahun ajaran tidak valid.",
      fieldErrors: { academicYearId: ["Pilih tahun ajaran yang benar"] },
    };
  }

  const meta = await requestMeta();
  const created = await prisma.internship.create({
    data: {
      schoolId,
      studentId: d.studentId,
      academicYearId: d.academicYearId,
      teacherId: d.teacherId ?? null,
      industryName: d.industryName,
      industryAddress: d.industryAddress ?? null,
      industryPhone: d.industryPhone ?? null,
      supervisorName: d.supervisorName ?? null,
      supervisorPhone: d.supervisorPhone ?? null,
      startDate: d.startDate,
      endDate: d.endDate,
      status: d.status,
      score: d.score ?? null,
      certificateNo: d.certificateNo ?? null,
      note: d.note ?? null,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "Internship",
    entityId: created.id,
    after: { student: student.fullName, industry: d.industryName },
    ...meta,
  });

  revalidatePath("/dashboard/academic/internships");
  return { ok: true, id: created.id, message: "Penempatan PKL disimpan." };
}

export async function updateInternship(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Permintaan tidak sah." };

  const parsed = internshipUpdateSchema.safeParse(
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

  const existing = await prisma.internship.findFirst({ where: { id, schoolId } });
  if (!existing) return { ok: false, error: "Data PKL tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.internship.update({
    where: { id },
    data: {
      studentId: d.studentId,
      academicYearId: d.academicYearId,
      teacherId: d.teacherId ?? null,
      industryName: d.industryName,
      industryAddress: d.industryAddress ?? null,
      industryPhone: d.industryPhone ?? null,
      supervisorName: d.supervisorName ?? null,
      supervisorPhone: d.supervisorPhone ?? null,
      startDate: d.startDate,
      endDate: d.endDate,
      status: d.status,
      score: d.score ?? null,
      certificateNo: d.certificateNo ?? null,
      note: d.note ?? null,
    },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "Internship",
    entityId: id,
    before: { industry: existing.industryName, status: existing.status },
    after: { industry: d.industryName, status: d.status },
    ...meta,
  });

  revalidatePath("/dashboard/academic/internships");
  return { ok: true, id, message: "Data PKL disimpan." };
}

export async function deleteInternship(id: string): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existing = await prisma.internship.findFirst({ where: { id, schoolId } });
  if (!existing) return { ok: false, error: "Data PKL tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.internship.delete({ where: { id } });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "Internship",
    entityId: id,
    before: { industry: existing.industryName },
    ...meta,
  });

  revalidatePath("/dashboard/academic/internships");
  return { ok: true, message: "Data PKL dihapus." };
}

/* ============================================================
 * UKK — UJI KOMPETENSI KEAHLIAN
 * ============================================================ */
export async function createCompetencyTest(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = competencyTestCreateSchema.safeParse(
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

  const [student, year, major] = await Promise.all([
    prisma.student.findFirst({
      where: { id: d.studentId, schoolId, deletedAt: null },
      select: { id: true, fullName: true },
    }),
    prisma.academicYear.findFirst({
      where: { id: d.academicYearId, schoolId },
      select: { id: true },
    }),
    prisma.major.findFirst({
      where: { id: d.majorId, schoolId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!student) {
    return {
      ok: false,
      error: "Siswa tidak valid.",
      fieldErrors: { studentId: ["Siswa tidak ditemukan"] },
    };
  }
  if (!year) {
    return {
      ok: false,
      error: "Tahun ajaran tidak valid.",
      fieldErrors: { academicYearId: ["Pilih tahun ajaran yang benar"] },
    };
  }
  if (!major) {
    return {
      ok: false,
      error: "Jurusan tidak valid.",
      fieldErrors: { majorId: ["Jurusan tidak ditemukan"] },
    };
  }

  const meta = await requestMeta();
  const created = await prisma.competencyTest.create({
    data: {
      schoolId,
      studentId: d.studentId,
      academicYearId: d.academicYearId,
      majorId: d.majorId,
      examinerName: d.examinerName,
      examinerOrg: d.examinerOrg ?? null,
      testDate: d.testDate,
      result: d.result,
      score: d.score ?? null,
      certificateNo: d.certificateNo ?? null,
      note: d.note ?? null,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "CompetencyTest",
    entityId: created.id,
    after: { student: student.fullName, result: d.result },
    ...meta,
  });

  revalidatePath("/dashboard/academic/competency-tests");
  return { ok: true, id: created.id, message: "Hasil UKK disimpan." };
}

export async function updateCompetencyTest(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = competencyTestUpdateSchema.safeParse(
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

  const existing = await prisma.competencyTest.findFirst({
    where: { id, schoolId },
  });
  if (!existing) return { ok: false, error: "Data UKK tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.competencyTest.update({
    where: { id },
    data: {
      studentId: d.studentId,
      academicYearId: d.academicYearId,
      majorId: d.majorId,
      examinerName: d.examinerName,
      examinerOrg: d.examinerOrg ?? null,
      testDate: d.testDate,
      result: d.result,
      score: d.score ?? null,
      certificateNo: d.certificateNo ?? null,
      note: d.note ?? null,
    },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "CompetencyTest",
    entityId: id,
    before: { result: existing.result, certificateNo: existing.certificateNo },
    after: { result: d.result, certificateNo: d.certificateNo ?? null },
    ...meta,
  });

  revalidatePath("/dashboard/academic/competency-tests");
  return { ok: true, id, message: "Hasil UKK disimpan." };
}

export async function deleteCompetencyTest(id: string): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existing = await prisma.competencyTest.findFirst({
    where: { id, schoolId },
  });
  if (!existing) return { ok: false, error: "Data UKK tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.competencyTest.delete({ where: { id } });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "CompetencyTest",
    entityId: id,
    before: { result: existing.result },
    ...meta,
  });

  revalidatePath("/dashboard/academic/competency-tests");
  return { ok: true, message: "Data UKK dihapus." };
}
