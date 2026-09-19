"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import {
  parseStudentWorkbook,
  type ParseResult,
} from "@/lib/import/students";

/**
 * Import siswa tahap 2: setelah PREVIEW (parse di client/server), admin
 * menekan "Import" dan baris valid disimpan.
 *
 * Baris tidak valid dilewati (tidak menggagalkan seluruh batch) dan
 * dilaporkan kembali.
 */

export type ImportCommitResult = {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  message?: string;
};

export async function previewImport(
  fileBuffer: ArrayBuffer,
): Promise<ParseResult> {
  return parseStudentWorkbook(fileBuffer);
}

export async function commitImport(
  fileBuffer: ArrayBuffer,
): Promise<ImportCommitResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "Sesi berakhir." };
  }
  if (!session.user.schoolId) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "Akun tidak terhubung ke sekolah." };
  }
  if (!can(session.user.role, "students", "create")) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "Tidak punya izin." };
  }

  const schoolId = session.user.schoolId;
  const parsed = parseStudentWorkbook(fileBuffer);

  if (parsed.headerErrors.length) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      errors: parsed.headerErrors,
      message: "Header file tidak sesuai template.",
    };
  }

  const h = await headers();
  const meta = {
    ipAddress: h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent") ?? null,
  };

  let imported = 0;
  let skipped = parsed.invalidCount;
  const errors: string[] = parsed.rows
    .filter((r) => !r.ok)
    .map((r) => `Baris ${r.rowNumber}: ${r.errors?.join("; ")}`);

  // NIS yang sudah ada di sekolah ini → dilewati.
  const existing = await prisma.student.findMany({
    where: { schoolId },
    select: { nis: true },
  });
  const existingNis = new Set(existing.map((s) => s.nis));

  for (const row of parsed.rows) {
    if (!row.ok || !row.data) continue;
    const d = row.data;

    if (existingNis.has(d.nis)) {
      skipped += 1;
      errors.push(`Baris ${row.rowNumber}: NIS ${d.nis} sudah ada, dilewati.`);
      continue;
    }

    try {
      await prisma.student.create({
        data: {
          schoolId,
          nis: d.nis,
          nisn: d.nisn ?? null,
          fullName: d.fullName,
          gender: d.gender,
          birthPlace: d.birthPlace ?? null,
          birthDate: d.birthDate ?? null,
          religion: d.religion ?? null,
          address: d.address ?? null,
          phone: d.phone ?? null,
          entryYear: d.entryYear,
          classId: d.classId ?? null,
          status: d.status,
          ...(d.parentName
            ? {
                parents: {
                  create: {
                    fullName: d.parentName,
                    relation: d.parentRelation ?? "GUARDIAN",
                    phone: d.parentPhone ?? "",
                    isPrimary: true,
                  },
                },
              }
            : {}),
        },
      });
      existingNis.add(d.nis);
      imported += 1;
    } catch {
      skipped += 1;
      errors.push(`Baris ${row.rowNumber}: gagal disimpan.`);
    }
  }

  await recordAudit({
    schoolId,
    userId: session.user.id,
    action: "IMPORT",
    entity: "Student",
    after: { imported, skipped },
    ...meta,
  });

  revalidatePath("/dashboard/students");

  return {
    ok: true,
    imported,
    skipped,
    errors: errors.slice(0, 50), // batasi payload pesan
    message: `${imported} siswa diimpor, ${skipped} dilewati.`,
  };
}
