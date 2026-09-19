import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listFeeTypes } from "@/lib/data/finance";
import { formatRupiah } from "@/lib/finance-calc";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { Button } from "@/components/ui";
import { FeeTypeForm, FeeTypeRow } from "./fee-client";
import { createFeeType, updateFeeType } from "../actions";

export const metadata = { title: "Jenis biaya" };

export default async function FeeTypesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "finance", "manage")) {
    return <p className="text-slate">Hanya admin dan bendahara yang dapat mengubah jenis biaya.</p>;
  }

  const fees = await listFeeTypes(schoolId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jenis biaya"
        context={`${fees.length} jenis biaya terdaftar`}
        actions={
          <Link href="/dashboard/finance">
            <Button variant="ghost">Kembali</Button>
          </Link>
        }
      />

      {fees.length === 0 ? (
        <EmptyState
          title="Belum ada jenis biaya"
          description="Tambahkan SPP, uang pangkal, atau biaya lain agar pembuatan tagihan lebih cepat."
        />
      ) : (
        <Table
          head={
            <>
              <th>Nama</th>
              <th className="w-28">Kode</th>
              <th className="w-32 text-right">Nominal</th>
              <th className="w-24">Berkala</th>
              <th className="w-24">Status</th>
              <th className="w-52 text-right">Aksi</th>
            </>
          }
        >
          {fees.map((f) => (
            <FeeTypeRow
              key={f.id}
              fee={{
                id: f.id,
                name: f.name,
                code: f.code,
                amount: f.amount,
                recurring: f.recurring,
                isActive: f.isActive,
                invoiceCount: f._count.invoices,
              }}
              updateAction={updateFeeType}
            />
          ))}
        </Table>
      )}

      <div className="max-w-2xl rounded-lg border border-chalk bg-white p-5">
        <h2 className="card-title mb-3">Tambah jenis biaya</h2>
        <FeeTypeForm action={createFeeType} />
      </div>

      <p className="text-xs text-slate">
        Jenis biaya <strong>berkala</strong> (mis. SPP) ditandai agar bisa dipakai
        saat membuat tagihan bulanan berulang. Nominal {formatRupiah(0).replace("0", "")}
        dalam Rupiah bulat.
      </p>
    </div>
  );
}
