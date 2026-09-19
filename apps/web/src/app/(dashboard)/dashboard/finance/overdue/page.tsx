import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listOverdueByStudent } from "@/lib/data/finance";
import { formatRupiah } from "@/lib/finance-calc";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { Button } from "@/components/ui";

export const metadata = { title: "Tunggakan" };

export default async function OverduePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "finance", "read")) {
    return <p className="text-slate">Anda tidak punya akses ke modul keuangan.</p>;
  }

  const rows = await listOverdueByStudent(schoolId);
  const total = rows.reduce((a, r) => a + r.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tunggakan"
        context={`${rows.length} siswa · total ${formatRupiah(total)}`}
        actions={
          <Link href="/dashboard/finance">
            <Button variant="ghost">Kembali</Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Tidak ada tunggakan"
          description="Semua tagihan yang jatuh tempo sudah lunas. Bagus!"
        />
      ) : (
        <>
          <Table
            head={
              <>
                <th>Siswa</th>
                <th className="w-28">Kelas</th>
                <th className="w-48">Orang tua / wali</th>
                <th className="w-24">Tagihan</th>
                <th className="w-32">Jatuh tempo tertua</th>
                <th className="w-32 text-right">Total tunggakan</th>
              </>
            }
          >
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td>
                  <Link
                    href={`/dashboard/finance/invoices?q=${encodeURIComponent(r.fullName)}`}
                    className="text-ink hover:text-board"
                  >
                    {r.fullName}
                  </Link>
                  {r.nis ? (
                    <span className="ml-2 font-mono text-xs text-slate">{r.nis}</span>
                  ) : null}
                </td>
                <td className="text-slate">{r.className ?? "—"}</td>
                <td className="text-sm">
                  {r.parentName ? (
                    <>
                      <span className="text-ink">{r.parentName}</span>
                      {r.parentPhone ? (
                        <span className="ml-2 font-mono text-xs text-slate">
                          {r.parentPhone}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-slate">Belum ada data wali</span>
                  )}
                </td>
                <td className="tabular-nums text-slate">{r.count}</td>
                <td className="text-slate">
                  {r.oldestDue.toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="text-right tabular-nums text-marker">
                  {formatRupiah(r.total)}
                </td>
              </tr>
            ))}
          </Table>

          <div className="rounded-lg border border-chalk bg-paper/40 p-4 text-sm text-slate">
            <p className="font-medium text-ink">Langkah berikutnya</p>
            <p className="mt-1">
              Data wali di atas siap dipakai untuk penagihan lewat WhatsApp —
              fitur pengiriman akan tersedia di modul Notifikasi WA (Fase 7).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
