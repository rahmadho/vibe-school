import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getInvoice, listPaymentMethods } from "@/lib/data/finance";
import { loadActiveGateway } from "@/lib/gateway-client";
import {
  formatRupiah,
  remainingAmount,
  INVOICE_STATUS_LABEL,
} from "@/lib/finance-calc";
import { GATEWAY_LABEL } from "@/lib/validations/finance";
import { PageHeader, Table } from "@/components/data-table";
import { Button } from "@/components/ui";
import { recordPayment } from "../../actions";
import { createPaymentLink } from "../../gateway-actions";
import { ManualPaymentForm, PaymentLinkButton } from "./payment-forms";
import { CancelInvoiceButton } from "./cancel-button";

export const metadata = { title: "Detail tagihan" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "finance", "read")) {
    return <p className="text-slate">Anda tidak punya akses ke modul keuangan.</p>;
  }
  const canManage = can(session.user.role, "finance", "manage");

  const { id } = await params;
  const inv = await getInvoice(schoolId, id);
  if (!inv) notFound();

  const [methods, gateway] = await Promise.all([
    listPaymentMethods(schoolId),
    loadActiveGateway(schoolId),
  ]);

  const sisa = remainingAmount(inv.totalAmount, inv.paidAmount);
  const overdue =
    sisa > 0 &&
    inv.dueDate.getTime() < Date.now() &&
    inv.status !== "CANCELLED" &&
    inv.status !== "REFUNDED";

  const statusLabel =
    INVOICE_STATUS_LABEL[inv.status as keyof typeof INVOICE_STATUS_LABEL] ?? inv.status;

  return (
    <div className="space-y-6">
      <PageHeader
        title={inv.title}
        context={`${inv.invoiceNo} · ${inv.student.fullName}${
          inv.student.class ? ` · ${inv.student.class.name}` : ""
        }`}
        actions={
          <Link href="/dashboard/finance/invoices">
            <Button variant="ghost">Kembali</Button>
          </Link>
        }
      />

      {/* Ringkasan status */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Box label="Total tagihan" value={formatRupiah(inv.totalAmount)} />
        <Box label="Sudah dibayar" value={formatRupiah(inv.paidAmount)} accent="board" />
        <Box
          label="Sisa"
          value={sisa === 0 ? "Lunas" : formatRupiah(sisa)}
          accent={sisa > 0 ? "marker" : "board"}
        />
        <Box
          label="Status"
          value={statusLabel}
          sub={`Jatuh tempo ${inv.dueDate.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}`}
          accent={overdue ? "marker" : undefined}
        />
      </div>

      {/* Rincian biaya */}
      <section>
        <h2 className="card-title mb-2">Rincian</h2>
        <Table
          head={
            <>
              <th>Keterangan</th>
              <th className="w-24">Jumlah</th>
              <th className="w-32 text-right">Nominal</th>
              <th className="w-32 text-right">Subtotal</th>
            </>
          }
        >
          {inv.items.map((it) => (
            <tr key={it.id}>
              <td className="text-ink">
                {it.description}
                {it.feeType ? (
                  <span className="ml-2 font-mono text-xs text-slate">
                    {it.feeType.code}
                  </span>
                ) : null}
              </td>
              <td className="tabular-nums text-slate">{it.quantity}</td>
              <td className="text-right tabular-nums text-slate">
                {formatRupiah(it.amount)}
              </td>
              <td className="text-right tabular-nums text-ink">
                {formatRupiah(it.amount * it.quantity)}
              </td>
            </tr>
          ))}
        </Table>
        {inv.note ? (
          <p className="mt-2 text-sm text-slate">Catatan: {inv.note}</p>
        ) : null}
      </section>

      {/* Riwayat pembayaran */}
      <section>
        <h2 className="card-title mb-2">
          Riwayat pembayaran ({inv.payments.length})
        </h2>
        {inv.payments.length === 0 ? (
          <p className="rounded-lg border border-chalk bg-white px-4 py-6 text-center text-sm text-slate">
            Belum ada pembayaran.
          </p>
        ) : (
          <Table
            head={
              <>
                <th className="w-32">Tanggal</th>
                <th className="w-32">Metode</th>
                <th>Referensi</th>
                <th className="w-32">Dicatat oleh</th>
                <th className="w-32 text-right">Nominal</th>
              </>
            }
          >
            {inv.payments.map((p) => (
              <tr key={p.id}>
                <td className="text-slate">
                  {p.paidAt.toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="text-slate">
                  {p.method?.name ?? (p.recordedById ? "Manual" : "Online")}
                </td>
                <td className="font-mono text-xs text-slate">
                  {p.reference ?? "—"}
                  {p.note ? (
                    <span className="ml-2 font-sans text-slate">{p.note}</span>
                  ) : null}
                </td>
                <td className="text-slate">
                  {p.recordedBy?.name ?? (
                    <span className="text-board">Webhook gateway</span>
                  )}
                </td>
                <td className="text-right tabular-nums text-ink">
                  {formatRupiah(p.amount)}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      {/* Transaksi gateway */}
      {inv.gatewayTxns.length > 0 ? (
        <section>
          <h2 className="card-title mb-2">Transaksi gateway</h2>
          <Table
            head={
              <>
                <th className="w-28">Provider</th>
                <th>ID eksternal</th>
                <th className="w-28">Status</th>
                <th className="w-32 text-right">Nominal</th>
                <th className="w-32">Dibayar</th>
              </>
            }
          >
            {inv.gatewayTxns.map((t) => (
              <tr key={t.id}>
                <td className="text-slate">{t.provider}</td>
                <td className="break-all font-mono text-xs text-slate">
                  {t.externalId}
                </td>
                <td className="text-slate">{t.status}</td>
                <td className="text-right tabular-nums text-slate">
                  {formatRupiah(t.amount)}
                </td>
                <td className="text-slate">
                  {t.paidAt
                    ? t.paidAt.toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </Table>
        </section>
      ) : null}

      {/* Aksi: catat pembayaran manual */}
      {canManage && sisa > 0 && inv.status !== "CANCELLED" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-chalk bg-white p-5">
            <h2 className="card-title">Catat pembayaran manual</h2>
            <p className="mb-4 mt-1 text-sm text-slate">
              Untuk pembayaran tunai atau transfer bank yang diterima langsung.
            </p>
            <ManualPaymentForm
              invoiceId={inv.id}
              remaining={sisa}
              methods={methods.map((m) => ({ id: m.id, name: m.name }))}
              action={recordPayment}
            />
          </div>

          <div className="rounded-lg border border-chalk bg-white p-5">
            <h2 className="card-title">Pembayaran online</h2>
            <p className="mb-4 mt-1 text-sm text-slate">
              Buat tautan/VA yang bisa dibagikan ke orang tua. Status terbarui
              otomatis saat dibayar.
            </p>
            <PaymentLinkButton
              invoiceId={inv.id}
              gatewayName={gateway ? GATEWAY_LABEL[gateway.provider] : null}
              action={createPaymentLink}
            />
          </div>
        </section>
      ) : null}

      {/* Batalkan tagihan */}
      {canManage && inv.status !== "CANCELLED" && inv.paidAmount === 0 ? (
        <section className="rounded-lg border border-chalk bg-white p-5">
          <h2 className="card-title">Batalkan tagihan</h2>
          <p className="mb-3 mt-1 text-sm text-slate">
            Tagihan tidak dihapus — hanya berstatus dibatalkan, agar jejaknya tetap
            ada di log.
          </p>
          <CancelInvoiceButton invoiceId={inv.id} />
        </section>
      ) : null}
    </div>
  );
}

function Box({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "board" | "marker";
}) {
  const color =
    accent === "marker" ? "text-marker" : accent === "board" ? "text-board" : "text-ink";
  return (
    <div className="rounded-lg border border-chalk bg-white p-4">
      <p className="text-xs text-slate">{label}</p>
      <p className={`mt-1 tabular-display text-xl ${color}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate">{sub}</p> : null}
    </div>
  );
}
