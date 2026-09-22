import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listInvoices } from "@/lib/data/finance";
import { INVOICE_STATUS_LABEL, formatRupiah, remainingAmount } from "@/lib/finance-calc";
import { PageHeader, Table, EmptyState, Pagination } from "@/components/data-table";
import { Button } from "@/components/ui";
import { Select } from "@/components/form-fields";

const STATUSES = ["ALL", "UNPAID", "PARTIAL", "OVERDUE", "PAID", "CANCELLED"] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "finance", "read", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya akses ke modul keuangan.</p>;
  }

  const sp = await searchParams;
  const years = await prisma.academicYear.findMany({
    where: { schoolId },
    select: { id: true, name: true, isActive: true },
    orderBy: { startDate: "desc" },
  });
  const activeYear = years.find((y) => y.isActive);

  let academicYearId: string | undefined;
  if (sp.academicYearId === "all") {
    academicYearId = undefined;
  } else if (typeof sp.academicYearId === "string" && sp.academicYearId.length > 0) {
    academicYearId = sp.academicYearId;
  } else {
    academicYearId = activeYear?.id;
  }

  const status = typeof sp.status === "string" ? sp.status : "ALL";
  const classId = typeof sp.classId === "string" ? sp.classId : "";
  const search = typeof sp.q === "string" ? sp.q : "";
  const page = sp.page ? Number(sp.page) : 1;

  const [classes, invoiceData] = await Promise.all([
    prisma.class.findMany({
      where: {
        schoolId,
        deletedAt: null,
        ...(academicYearId ? { academicYearId } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listInvoices(schoolId, {
      status,
      classId: classId || undefined,
      academicYearId,
      search,
      page,
      perPage: 25,
    }),
  ]);
  const invoices = invoiceData.items;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tagihan"
        context={`${invoiceData.total} tagihan · halaman ${invoiceData.page} dari ${invoiceData.totalPages}`}
        actions={
          <>
            <Link href="/dashboard/finance/invoices/new">
              <Button>Buat tagihan</Button>
            </Link>
            <Link href="/dashboard/finance">
              <Button variant="ghost">Kembali</Button>
            </Link>
          </>
        }
      />

      <form
        action="/dashboard/finance/invoices"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
      >
        <div className="w-52">
          <label htmlFor="academicYearId" className="mb-1 block text-xs font-medium text-slate">
            Tahun ajaran
          </label>
          <Select
            id="academicYearId"
            name="academicYearId"
            defaultValue={sp.academicYearId === "all" ? "all" : (academicYearId ?? "")}
          >
            <option value="all">Semua tahun</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.isActive ? "(aktif)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-slate">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "Semua status" : INVOICE_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <label htmlFor="classId" className="mb-1 block text-xs font-medium text-slate">
            Kelas
          </label>
          <Select id="classId" name="classId" defaultValue={classId}>
            <option value="">Semua kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-56">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate">
            Cari
          </label>
          <input
            id="q"
            name="q"
            defaultValue={search}
            placeholder="No. tagihan / nama siswa"
            className="h-9 w-full rounded border border-chalk px-3 text-sm focus:border-board focus:outline-none"
          />
        </div>
        <Button type="submit">Terapkan</Button>
      </form>

      {invoices.length === 0 ? (
        <EmptyState
          title="Belum ada tagihan"
          description="Buat tagihan untuk satu siswa, atau buat massal untuk seluruh kelas."
          action={
            <Link href="/dashboard/finance/invoices/new">
              <Button>Buat tagihan</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Table
            head={
              <>
                <th className="w-40">No. tagihan</th>
                <th>Siswa</th>
                <th className="w-52">Judul</th>
                <th className="w-28 text-right">Tagihan</th>
                <th className="w-28 text-right">Dibayar</th>
                <th className="w-28 text-right">Sisa</th>
                <th className="w-24">Jatuh tempo</th>
                <th className="w-28">Status</th>
              </>
            }
          >
          {invoices.map((inv) => {
            const sisa = remainingAmount(inv.totalAmount, inv.paidAmount);
            const overdue =
              sisa > 0 &&
              inv.dueDate.getTime() < Date.now() &&
              inv.status !== "CANCELLED" &&
              inv.status !== "REFUNDED";
            return (
              <tr key={inv.id} className="cursor-pointer hover:bg-paper/60">
                <td>
                  <Link
                    href={`/dashboard/finance/invoices/${inv.id}`}
                    className="font-mono text-xs text-board hover:underline"
                  >
                    {inv.invoiceNo}
                  </Link>
                </td>
                <td>
                  <span className="text-ink">{inv.student.fullName}</span>
                  <span className="ml-2 text-xs text-slate">
                    {inv.student.class?.name ?? "—"}
                  </span>
                </td>
                <td className="text-slate">{inv.title}</td>
                <td className="text-right tabular-nums text-slate">
                  {formatRupiah(inv.totalAmount)}
                </td>
                <td className="text-right tabular-nums text-slate">
                  {formatRupiah(inv.paidAmount)}
                </td>
                <td
                  className={`text-right tabular-nums ${
                    sisa > 0 ? "text-marker" : "text-board"
                  }`}
                >
                  {sisa === 0 ? "Lunas" : formatRupiah(sisa)}
                </td>
                <td className={`text-xs ${overdue ? "text-marker" : "text-slate"}`}>
                  {inv.dueDate.toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate">
                    <StatusDot status={inv.status} />
                    {INVOICE_STATUS_LABEL[
                      inv.status as keyof typeof INVOICE_STATUS_LABEL
                    ] ?? inv.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </Table>
        <Pagination
          page={invoiceData.page}
          totalPages={invoiceData.totalPages}
          total={invoiceData.total}
          basePath="/dashboard/finance/invoices"
          params={{
            status,
            classId,
            q: search,
          }}
          itemLabel="tagihan"
        />
        </>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "PAID"
      ? "bg-board"
      : status === "OVERDUE"
        ? "bg-marker"
        : status === "PARTIAL"
          ? "bg-slate"
          : "bg-chalk";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />;
}
