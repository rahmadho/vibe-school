import "server-only";
import { prisma } from "@/lib/prisma";
import {
  summarizeInvoices,
  formatRupiah,
  INVOICE_STATUS_LABEL,
  type InvoiceStatusValue,
} from "@/lib/finance-calc";

/**
 * Query layer Keuangan.
 * Isolasi tenant: semua query difilter schoolId dari sesi.
 */

/* ============================================================
 * JENIS BIAYA
 * ============================================================ */

export async function listFeeTypes(schoolId: string, onlyActive = false) {
  return prisma.feeType.findMany({
    where: { schoolId, ...(onlyActive ? { isActive: true } : {}) },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { invoices: true } } },
  });
}

export async function getFeeType(schoolId: string, id: string) {
  return prisma.feeType.findFirst({ where: { id, schoolId } });
}

/* ============================================================
 * METODE PEMBAYARAN
 * ============================================================ */

export async function listPaymentMethods(schoolId: string) {
  return prisma.paymentMethod.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
  });
}

/* ============================================================
 * TAGIHAN
 * ============================================================ */

export type InvoiceFilter = {
  status?: string;
  classId?: string;
  studentId?: string;
  /** Hanya yang masih ada sisa & sudah lewat jatuh tempo. */
  overdueOnly?: boolean;
  search?: string;
  take?: number;
  skip?: number;
};

export async function listInvoices(schoolId: string, filter: InvoiceFilter = {}) {
  const where: Record<string, unknown> = { schoolId, deletedAt: null };

  if (filter.status && filter.status !== "ALL") {
    where.status = filter.status;
  }
  if (filter.studentId) where.studentId = filter.studentId;
  if (filter.classId) where.student = { classId: filter.classId };
  if (filter.search) {
    where.OR = [
      { invoiceNo: { contains: filter.search, mode: "insensitive" } },
      { title: { contains: filter.search, mode: "insensitive" } },
      { student: { fullName: { contains: filter.search, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.invoice.findMany({
    where,
    orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    take: filter.take ?? 100,
    skip: filter.skip ?? 0,
    include: {
      student: { select: { id: true, fullName: true, nis: true, class: { select: { name: true } } } },
      items: true,
      _count: { select: { payments: true } },
    },
  });

  // Filter tunggakan dilakukan di memori karena butuh perbandingan
  // paidAmount < totalAmount (tidak bisa diekspresikan langsung di Prisma).
  if (filter.overdueOnly) {
    const now = new Date();
    return rows.filter(
      (r) =>
        r.paidAmount < r.totalAmount &&
        r.dueDate.getTime() < now.getTime() &&
        r.status !== "CANCELLED" &&
        r.status !== "REFUNDED",
    );
  }
  return rows;
}

export async function getInvoice(schoolId: string, id: string) {
  return prisma.invoice.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          nis: true,
          class: { select: { name: true } },
          parents: { select: { id: true, fullName: true, phone: true, relation: true } },
        },
      },
      items: { include: { feeType: { select: { name: true, code: true } } } },
      payments: {
        orderBy: { paidAt: "desc" },
        include: {
          method: { select: { name: true } },
          recordedBy: { select: { name: true } },
        },
      },
      gatewayTxns: { orderBy: { createdAt: "desc" } },
    },
  });
}

/** Ringkasan keuangan sekolah untuk dasbor. */
export async function getFinanceSummary(schoolId: string) {
  const rows = await prisma.invoice.findMany({
    where: { schoolId, deletedAt: null },
    select: { totalAmount: true, paidAmount: true, dueDate: true, status: true },
  });
  const s = summarizeInvoices(
    rows.map((r) => ({
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
      dueDate: r.dueDate,
      status: r.status,
    })),
  );
  return {
    ...s,
    billedLabel: formatRupiah(s.billed),
    collectedLabel: formatRupiah(s.collected),
    outstandingLabel: formatRupiah(s.outstanding),
    overdueAmountLabel: formatRupiah(s.overdueAmount),
  };
}

/** Daftar siswa dengan tunggakan (untuk penagihan). */
export async function listOverdueByStudent(schoolId: string, limit = 200) {
  const rows = await prisma.invoice.findMany({
    where: {
      schoolId,
      deletedAt: null,
      status: { notIn: ["PAID", "CANCELLED", "REFUNDED"] },
    },
    orderBy: { dueDate: "asc" },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          nis: true,
          class: { select: { name: true } },
          parents: {
            where: { isPrimary: true },
            select: { fullName: true, phone: true },
            take: 1,
          },
        },
      },
    },
  });

  const now = new Date();
  const byStudent = new Map<
    string,
    {
      studentId: string;
      fullName: string;
      nis: string | null;
      className: string | null;
      parentName: string | null;
      parentPhone: string | null;
      total: number;
      count: number;
      oldestDue: Date;
    }
  >();

  for (const r of rows) {
    if (r.paidAmount >= r.totalAmount) continue;
    if (r.dueDate.getTime() >= now.getTime()) continue; // belum jatuh tempo
    const sisa = r.totalAmount - r.paidAmount;
    const cur = byStudent.get(r.studentId);
    if (cur) {
      cur.total += sisa;
      cur.count += 1;
      if (r.dueDate < cur.oldestDue) cur.oldestDue = r.dueDate;
    } else {
      const p = r.student.parents[0];
      byStudent.set(r.studentId, {
        studentId: r.studentId,
        fullName: r.student.fullName,
        nis: r.student.nis,
        className: r.student.class?.name ?? null,
        parentName: p?.fullName ?? null,
        parentPhone: p?.phone ?? null,
        total: sisa,
        count: 1,
        oldestDue: r.dueDate,
      });
    }
  }

  return Array.from(byStudent.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/** Nomor tagihan berikutnya (berdasarkan hitungan bulan berjalan). */
export async function nextInvoiceSequence(
  schoolId: string,
  date: Date = new Date(),
): Promise<number> {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const count = await prisma.invoice.count({
    where: { schoolId, createdAt: { gte: start, lt: end } },
  });
  return count + 1;
}

/* ============================================================
 * KONFIGURASI GATEWAY
 * ============================================================ */

export async function listGatewayConfigs(schoolId: string) {
  return prisma.schoolPaymentGateway.findMany({
    where: { schoolId },
    orderBy: { provider: "asc" },
  });
}

export function statusLabel(status: string): string {
  return INVOICE_STATUS_LABEL[status as InvoiceStatusValue] ?? status;
}

export { formatRupiah };
