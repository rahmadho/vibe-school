"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  feeTypeCreateSchema,
  feeTypeUpdateSchema,
  invoiceCreateSchema,
  invoiceBulkSchema,
  paymentCreateSchema,
  paymentMethodCreateSchema,
} from "@/lib/validations/finance";
import {
  resolveInvoiceStatus,
  validatePayment,
  remainingAmount,
  buildInvoiceNumber,
  formatRupiah,
} from "@/lib/finance-calc";

/**
 * Server actions Keuangan.
 *
 * PRINSIP: satu-satunya jalan mencatat uang masuk adalah lewat `recordPayment`
 * (manual) atau `applyGatewayPayment` (webhook). Keduanya memakai perhitungan
 * yang sama sehingga status tagihan tidak pernah bisa "lompat" jadi lunas
 * hanya karena satu jalur lupa memperbarui `paidAmount`.
 */

/* ============================================================
 * JENIS BIAYA
 * ============================================================ */

export async function createFeeType(formData: FormData): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;

  const parsed = feeTypeCreateSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    amount: formData.get("amount"),
    recurring: formData.get("recurring") ?? undefined,
    isActive: formData.get("isActive") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const dup = await prisma.feeType.findFirst({
    where: { schoolId: g.ctx.schoolId, code: parsed.data.code },
  });
  if (dup) return { ok: false, error: `Kode "${parsed.data.code}" sudah dipakai.` };

  const meta = await requestMeta();
  const created = await prisma.feeType.create({
    data: { schoolId: g.ctx.schoolId, ...parsed.data },
  });

  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "FeeType",
    entityId: created.id,
    after: { name: created.name, code: created.code, amount: created.amount },
    ...meta,
  });

  revalidatePath("/dashboard/finance/fees");
  revalidatePath("/dashboard/finance");
  return { ok: true, message: `Jenis biaya "${created.name}" dibuat.` };
}

export async function updateFeeType(formData: FormData): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;

  const parsed = feeTypeUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    code: formData.get("code"),
    amount: formData.get("amount"),
    recurring: formData.get("recurring") ?? undefined,
    isActive: formData.get("isActive") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const { id, ...data } = parsed.data;

  const existing = await prisma.feeType.findFirst({ where: { id, schoolId: g.ctx.schoolId } });
  if (!existing) return { ok: false, error: "Jenis biaya tidak ditemukan." };

  const dup = await prisma.feeType.findFirst({
    where: { schoolId: g.ctx.schoolId, code: data.code, NOT: { id } },
  });
  if (dup) return { ok: false, error: `Kode "${data.code}" sudah dipakai.` };

  const meta = await requestMeta();
  await prisma.feeType.update({ where: { id }, data });
  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "FeeType",
    entityId: id,
    before: { name: existing.name, code: existing.code, amount: existing.amount },
    after: { name: data.name, code: data.code, amount: data.amount },
    ...meta,
  });

  revalidatePath("/dashboard/finance/fees");
  return { ok: true, message: "Jenis biaya diperbarui." };
}

/* ============================================================
 * METODE PEMBAYARAN
 * ============================================================ */

export async function createPaymentMethod(formData: FormData): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;

  const parsed = paymentMethodCreateSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  const dup = await prisma.paymentMethod.findFirst({
    where: { schoolId: g.ctx.schoolId, code: parsed.data.code },
  });
  if (dup) return { ok: false, error: `Kode "${parsed.data.code}" sudah dipakai.` };

  const created = await prisma.paymentMethod.create({
    data: { schoolId: g.ctx.schoolId, ...parsed.data },
  });

  revalidatePath("/dashboard/finance/methods");
  return { ok: true, message: `Metode "${created.name}" ditambahkan.` };
}

/* ============================================================
 * TAGIHAN
 * ============================================================ */

/** Buat satu tagihan untuk satu siswa. */
export async function createInvoice(formData: FormData): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;

  // Rincian dikirim sebagai JSON array dari klien.
  let itemsRaw: unknown = [];
  try {
    itemsRaw = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "Rincian tagihan tidak valid." };
  }

  const parsed = invoiceCreateSchema.safeParse({
    studentId: formData.get("studentId"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate"),
    note: formData.get("note") ?? undefined,
    items: itemsRaw,
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const d = parsed.data;

  // Siswa wajib milik sekolah ini.
  const student = await prisma.student.findFirst({
    where: { id: d.studentId, schoolId: g.ctx.schoolId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!student) return { ok: false, error: "Siswa tidak ditemukan di sekolah ini." };

  const total = d.items.reduce((a, it) => a + it.amount * it.quantity, 0);
  if (total <= 0) return { ok: false, error: "Total tagihan harus lebih dari nol." };

  const meta = await requestMeta();
  const seq = await nextSequence(g.ctx.schoolId);
  const now = new Date();
  const invoiceNo = buildInvoiceNumber("INV", now, seq);

  const created = await prisma.invoice.create({
    data: {
      schoolId: g.ctx.schoolId,
      studentId: student.id,
      invoiceNo,
      title: d.title,
      totalAmount: total,
      paidAmount: 0,
      status: "UNPAID",
      dueDate: new Date(`${d.dueDate}T23:59:59`),
      note: d.note ?? null,
      items: {
        create: d.items.map((it) => ({
          feeTypeId: it.feeTypeId ?? null,
          description: it.description,
          amount: it.amount,
          quantity: it.quantity,
        })),
      },
    },
  });

  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "Invoice",
    entityId: created.id,
    after: {
      invoiceNo,
      student: student.fullName,
      totalAmount: total,
      dueDate: d.dueDate,
    },
    ...meta,
  });

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/finance/invoices");
  return { ok: true, message: `Tagihan ${invoiceNo} dibuat untuk ${student.fullName}.` };
}

/** Buat tagihan massal untuk seluruh siswa satu kelas. */
export async function createBulkInvoice(formData: FormData): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;

  const studentIds = formData.getAll("studentIds").map(String).filter(Boolean);
  const parsed = invoiceBulkSchema.safeParse({
    classId: formData.get("classId"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate"),
    feeTypeId: formData.get("feeTypeId") ?? undefined,
    amount: formData.get("amount"),
    note: formData.get("note") ?? undefined,
    studentIds,
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const d = parsed.data;

  // Hanya siswa yang benar-benar milik kelas & sekolah ini.
  const students = await prisma.student.findMany({
    where: {
      id: { in: d.studentIds },
      schoolId: g.ctx.schoolId,
      classId: d.classId,
      deletedAt: null,
    },
    select: { id: true, fullName: true },
  });
  if (students.length === 0) {
    return { ok: false, error: "Tidak ada siswa yang cocok di kelas ini." };
  }
  if (students.length !== d.studentIds.length) {
    // Sebagian id tidak valid — hentikan daripada membuat tagihan setengah.
    return {
      ok: false,
      error:
        "Sebagian siswa tidak berada di kelas ini. Muat ulang halaman dan coba lagi.",
    };
  }

  const meta = await requestMeta();
  const due = new Date(`${d.dueDate}T23:59:59`);
  const now = new Date();
  let seq = await nextSequence(g.ctx.schoolId);

  // Nomor tagihan dibuat berurutan & unik untuk setiap siswa.
  const payload = students.map((s, i) => ({
    schoolId: g.ctx.schoolId,
    studentId: s.id,
    invoiceNo: buildInvoiceNumber("INV", now, seq + i),
    title: d.title,
    totalAmount: d.amount,
    paidAmount: 0,
    status: "UNPAID" as const,
    dueDate: due,
    note: d.note ?? null,
  }));

  await prisma.$transaction(async (tx) => {
    for (const p of payload) {
      await tx.invoice.create({
        data: {
          ...p,
          items: {
            create: [
              {
                feeTypeId: d.feeTypeId ?? null,
                description: d.title,
                amount: d.amount,
                quantity: 1,
              },
            ],
          },
        },
      });
    }
  });
  seq += students.length;

  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "Invoice",
    entityId: `bulk:${d.classId}`,
    after: {
      count: students.length,
      title: d.title,
      amountPerStudent: d.amount,
      dueDate: d.dueDate,
    },
    ...meta,
  });

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/finance/invoices");
  return {
    ok: true,
    message: `${students.length} tagihan dibuat (${formatRupiah(d.amount)} per siswa).`,
  };
}

/** Batalkan tagihan (tidak dihapus — jejak tetap ada). */
export async function cancelInvoice(id: string): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;

  const inv = await prisma.invoice.findFirst({
    where: { id, schoolId: g.ctx.schoolId, deletedAt: null },
  });
  if (!inv) return { ok: false, error: "Tagihan tidak ditemukan." };
  if (inv.status === "CANCELLED") return { ok: false, error: "Tagihan sudah dibatalkan." };
  if (inv.paidAmount > 0) {
    return {
      ok: false,
      error: "Tagihan sudah ada pembayaran. Kembalikan dana dulu sebelum dibatalkan.",
    };
  }

  const meta = await requestMeta();
  await prisma.invoice.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "Invoice",
    entityId: id,
    before: { status: inv.status },
    after: { status: "CANCELLED" },
    ...meta,
  });

  revalidatePath("/dashboard/finance/invoices");
  revalidatePath(`/dashboard/finance/invoices/${id}`);
  return { ok: true, message: `Tagihan ${inv.invoiceNo} dibatalkan.` };
}

/* ============================================================
 * PEMBAYARAN MANUAL
 * ============================================================ */

/**
 * Catat pembayaran manual (tunai / transfer bank).
 * Ini jalur yang dipakai bendahara sekolah sehari-hari.
 */
export async function recordPayment(formData: FormData): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;

  const parsed = paymentCreateSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount"),
    methodId: formData.get("methodId") ?? undefined,
    paidAt: formData.get("paidAt") ?? undefined,
    reference: formData.get("reference") ?? undefined,
    note: formData.get("note") ?? undefined,
    proofUrl: formData.get("proofUrl") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const d = parsed.data;

  const inv = await prisma.invoice.findFirst({
    where: { id: d.invoiceId, schoolId: g.ctx.schoolId, deletedAt: null },
  });
  if (!inv) return { ok: false, error: "Tagihan tidak ditemukan." };
  if (inv.status === "CANCELLED") return { ok: false, error: "Tagihan sudah dibatalkan." };

  // Validasi nominal terhadap sisa tagihan (server, bukan sekadar UI).
  const err = validatePayment(inv.totalAmount, inv.paidAmount, d.amount);
  if (err) return { ok: false, error: err };

  if (d.methodId) {
    const m = await prisma.paymentMethod.findFirst({
      where: { id: d.methodId, schoolId: g.ctx.schoolId },
    });
    if (!m) return { ok: false, error: "Metode pembayaran tidak valid." };
  }

  const meta = await requestMeta();
  const paidAt = d.paidAt ? new Date(`${d.paidAt}T12:00:00`) : new Date();
  const newPaid = inv.paidAmount + d.amount;
  const newStatus = resolveInvoiceStatus(
    inv.totalAmount,
    newPaid,
    inv.dueDate,
    new Date(),
    inv.status as never,
  );

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        schoolId: g.ctx.schoolId,
        invoiceId: inv.id,
        amount: d.amount,
        methodId: d.methodId ?? null,
        paidAt,
        reference: d.reference ?? null,
        proofUrl: d.proofUrl ?? null,
        note: d.note ?? null,
        recordedById: g.ctx.userId,
      },
    });
    await tx.invoice.update({
      where: { id: inv.id },
      data: { paidAmount: newPaid, status: newStatus },
    });
    return p;
  });

  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "Payment",
    entityId: payment.id,
    after: {
      invoiceNo: inv.invoiceNo,
      amount: d.amount,
      method: "MANUAL",
      paidAt: paidAt.toISOString(),
      invoiceStatus: newStatus,
    },
    ...meta,
  });

  revalidatePath("/dashboard/finance/invoices");
  revalidatePath(`/dashboard/finance/invoices/${inv.id}`);

  return {
    ok: true,
    message:
      newStatus === "PAID"
        ? `Pembayaran ${formatRupiah(d.amount)} dicatat. Tagihan LUNAS.`
        : `Pembayaran ${formatRupiah(d.amount)} dicatat. Sisa ${formatRupiah(
            remainingAmount(inv.totalAmount, newPaid),
          )}.`,
  };
}

/* ============================================================
 * UTIL INTERNAL
 * ============================================================ */

async function nextSequence(schoolId: string): Promise<number> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const count = await prisma.invoice.count({
    where: { schoolId, createdAt: { gte: start, lt: end } },
  });
  return count + 1;
}
