import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listPaymentMethods } from "@/lib/data/finance";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { Button } from "@/components/ui";
import { createPaymentMethod } from "../actions";
import { PaymentMethodForm } from "./method-form";

export const metadata = { title: "Metode pembayaran" };

export default async function PaymentMethodsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "finance", "manage")) {
    return <p className="text-slate">Hanya admin dan bendahara yang dapat mengubah metode pembayaran.</p>;
  }

  const methods = await listPaymentMethods(schoolId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metode pembayaran"
        context="Dipakai saat mencatat pembayaran manual"
        actions={
          <Link href="/dashboard/finance">
            <Button variant="ghost">Kembali</Button>
          </Link>
        }
      />

      <p className="rounded-lg border border-chalk bg-paper/40 px-4 py-3 text-sm text-slate">
        Metode di sini untuk <strong>pencatatan manual</strong> oleh bendahara
        (tunai, transfer bank). Untuk pembayaran online otomatis, gunakan{" "}
        <Link href="/dashboard/finance/gateway" className="text-board underline">
          payment gateway
        </Link>
        .
      </p>

      {methods.length === 0 ? (
        <EmptyState
          title="Belum ada metode pembayaran"
          description="Tambahkan Tunai, Transfer BCA, atau QRIS manual agar pencatatan lebih konsisten."
        />
      ) : (
        <Table
          head={
            <>
              <th>Nama</th>
              <th className="w-32">Kode</th>
              <th className="w-32">Status</th>
            </>
          }
        >
          {methods.map((m) => (
            <tr key={m.id}>
              <td className="text-ink">{m.name}</td>
              <td className="font-mono text-xs text-slate">{m.code}</td>
              <td>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      m.isActive ? "bg-board" : "bg-chalk"
                    }`}
                    aria-hidden
                  />
                  {m.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <div className="max-w-xl rounded-lg border border-chalk bg-white p-5">
        <h2 className="card-title mb-3">Tambah metode</h2>
        <PaymentMethodForm action={createPaymentMethod} />
      </div>
    </div>
  );
}
