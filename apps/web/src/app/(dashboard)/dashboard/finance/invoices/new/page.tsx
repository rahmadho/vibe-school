import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listFeeTypes } from "@/lib/data/finance";
import { PageHeader } from "@/components/data-table";
import { Button } from "@/components/ui";
import { createInvoice, createBulkInvoice } from "../../actions";
import { InvoiceForm, BulkInvoiceForm } from "../invoice-forms";

export const metadata = { title: "Buat tagihan" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "finance", "manage")) {
    return <p className="text-slate">Hanya admin dan bendahara yang dapat membuat tagihan.</p>;
  }

  const sp = await searchParams;
  const isBulk = sp.bulk === "1";

  const [students, classes, feeTypes] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, nis: true, classId: true },
    }),
    prisma.class.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listFeeTypes(schoolId, true),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isBulk ? "Tagihan massal" : "Buat tagihan"}
        context={
          isBulk
            ? "Buat tagihan yang sama untuk banyak siswa sekaligus"
            : "Buat satu tagihan untuk seorang siswa"
        }
        actions={
          <Link href="/dashboard/finance/invoices">
            <Button variant="ghost">Kembali</Button>
          </Link>
        }
      />

      <div className="flex gap-2">
        <Link href="/dashboard/finance/invoices/new">
          <Button variant={isBulk ? "ghost" : "primary"}>Satu siswa</Button>
        </Link>
        <Link href="/dashboard/finance/invoices/new?bulk=1">
          <Button variant={isBulk ? "primary" : "ghost"}>Massal (per kelas)</Button>
        </Link>
      </div>

      {students.length === 0 ? (
        <p className="rounded-lg border border-chalk bg-white px-4 py-10 text-center text-slate">
          Belum ada siswa. Tambahkan siswa terlebih dahulu.
        </p>
      ) : isBulk ? (
        <BulkInvoiceForm
          classes={classes}
          students={students}
          feeTypes={feeTypes.map((f) => ({
            id: f.id,
            name: f.name,
            amount: f.amount,
            code: f.code,
          }))}
          action={createBulkInvoice}
        />
      ) : (
        <InvoiceForm
          students={students}
          feeTypes={feeTypes.map((f) => ({
            id: f.id,
            name: f.name,
            amount: f.amount,
            code: f.code,
          }))}
          action={createInvoice}
        />
      )}
    </div>
  );
}
