import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getFinanceSummary } from "@/lib/data/finance";
import { INVOICE_STATUS_LABEL } from "@/lib/finance-calc";
import { PageHeader } from "@/components/data-table";
import { Button } from "@/components/ui";
import { YearFilterSelect } from "./year-filter";

export const metadata = { title: "Keuangan" };

export default async function FinancePage({
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
  const s = await getFinanceSummary(schoolId, academicYearId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Keuangan</h1>
          <p className="mt-1 text-sm text-slate">
            Tagihan, pembayaran manual &amp; online, tunggakan ·{" "}
            {selectedYear ? `Tahun ajaran ${selectedYear.name}` : "Semua tahun"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <YearFilterSelect
            years={years}
            currentValue={sp.academicYearId === "all" ? "all" : (academicYearId ?? "")}
          />
          <Link href="/dashboard/finance/invoices/new">
            <Button>Buat tagihan</Button>
          </Link>
          <Link href="/dashboard/finance/gateway">
            <Button variant="ghost">Pengaturan gateway</Button>
          </Link>
        </div>
      </div>

      {/* Kartu ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Total ditagihkan" value={s.billedLabel} />
        <Card label="Sudah diterima" value={s.collectedLabel} accent="board" />
        <Card label="Belum terbayar" value={s.outstandingLabel} />
        <Card
          label="Tunggakan (lewat tempo)"
          value={s.overdueAmountLabel}
          sub={`${s.overdueCount} tagihan`}
          accent={s.overdueCount > 0 ? "marker" : undefined}
        />
      </div>

      {/* Bilah progres penagihan */}
      <div className="rounded-lg border border-chalk bg-white p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm text-slate">Tingkat penagihan</p>
          <p className="tabular-display text-2xl text-ink">{s.collectionRate}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper">
          <div
            className="h-full bg-board"
            style={{ width: `${Math.min(100, s.collectionRate)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate">
          {s.paidCount} dari {s.count} tagihan sudah lunas.
        </p>
      </div>

      {/* Navigasi modul keuangan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NavCard
          href="/dashboard/finance/invoices"
          title="Tagihan"
          desc="Daftar seluruh tagihan siswa, filter status & kelas."
        />
        <NavCard
          href="/dashboard/finance/overdue"
          title="Tunggakan"
          desc="Siswa yang menunggak, siap untuk penagihan via WhatsApp."
        />
        <NavCard
          href="/dashboard/finance/fees"
          title="Jenis biaya"
          desc="SPP, uang pangkal, seragam — beserta nominalnya."
        />
        <NavCard
          href="/dashboard/finance/methods"
          title="Metode pembayaran"
          desc="Tunai, transfer bank, QRIS — untuk pencatatan manual."
        />
        <NavCard
          href="/dashboard/finance/gateway"
          title="Payment gateway"
          desc="Aktifkan Midtrans atau Xendit untuk pembayaran online."
        />
        <NavCard
          href="/dashboard/finance/invoices/new?bulk=1"
          title="Tagihan massal"
          desc="Buat tagihan untuk seluruh siswa satu kelas sekaligus."
        />
      </div>

      <div className="rounded-lg border border-chalk bg-paper/40 p-4 text-sm text-slate">
        <p className="font-medium text-ink">Dua cara menerima pembayaran</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Manual</strong> — bendahara menerima tunai/transfer lalu
            mencatatnya di detail tagihan ({INVOICE_STATUS_LABEL.PARTIAL} →{" "}
            {INVOICE_STATUS_LABEL.PAID}).
          </li>
          <li>
            <strong>Online</strong> — orang tua membayar lewat tautan/VA Midtrans
            atau Xendit; status terbarui otomatis dari webhook.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Card({
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
      <p className={`mt-1 tabular-display text-2xl ${color}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate">{sub}</p> : null}
    </div>
  );
}

function NavCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-chalk bg-white p-5 transition-colors hover:border-board"
    >
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-slate">{desc}</p>
    </Link>
  );
}
