import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listOverdueByStudent, formatRupiah } from "@/lib/data/finance";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { Button } from "@/components/ui";
import { YearFilterSelect } from "../year-filter";
export const metadata = { title: "Tunggakan" };

export default async function OverduePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "finance", "read")) {
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

  const selectedYear = years.find((y) => y.id === academicYearId);
  const rows = await listOverdueByStudent(schoolId, { academicYearId });
  const total = rows.reduce((a, r) => a + r.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Tunggakan</h1>
          <p className="mt-1 text-sm text-slate">
            {rows.length} siswa · total {formatRupiah(total)} ·{" "}
            {selectedYear ? `Tahun ${selectedYear.name}` : "Semua tahun"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <YearFilterSelect
            years={years}
            currentValue={sp.academicYearId === "all" ? "all" : (academicYearId ?? "")}
          />
          <Link href="/dashboard/finance">
            <Button variant="ghost">Kembali</Button>
          </Link>
        </div>
      </div>
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
