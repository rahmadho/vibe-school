import "server-only";
import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Audit log — mencatat mutasi penting (uang, nilai, absensi, data siswa).
 * Lihat AGENTS.md aturan #5.
 *
 * Sengaja tidak melempar error bila pencatatan gagal: audit yang gagal tidak
 * boleh membatalkan operasi bisnis yang sudah berhasil. Kegagalan dicatat ke
 * console untuk ditindaklanjuti.
 */
export async function recordAudit(input: {
  schoolId: string | null;
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        schoolId: input.schoolId,
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    // Jangan batalkan operasi bisnis karena audit gagal.
    // eslint-disable-next-line no-console
    console.error("[audit] gagal mencatat:", err);
  }
}
