import Link from "next/link";
import { guard } from "@/lib/action-guard";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/format";
import { BatchList } from "./batch-list";

/**
 * Panel SPMB untuk panitia sekolah.
 *
 * Menampilkan gelombang pendaftaran beserta JALUR di dalamnya (Reguler,
 * Prestasi, Afirmasi, …). Satu gelombang boleh punya beberapa jalur dengan
 * biaya dan kuota masing-masing — ini permintaan khusus pemilik produk.
 */

export const metadata = { title: "SPMB" };
export const dynamic = "force-dynamic";

export default async function SpmbPage() {
  const g = await guard("spmb", "read");
  if ("fail" in g) {
    return (
      <div className="mx-auto max-w-md border-2 border-[var(--chalk)] bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">
          Tidak dapat diakses
        </p>
        <p className="mt-2 text-sm text-[var(--slate)]">
          {g.fail.ok ? "Tidak diizinkan." : g.fail.error}
        </p>
      </div>
    );
  }

  const { schoolId } = g.ctx;

  const [batches, academicYears, statusCounts, canManage] = await Promise.all([
    prisma.admissionBatch.findMany({
      where: { schoolId },
      orderBy: [{ openDate: "desc" }],
      include: {
        paths: {
          orderBy: { order: "asc" },
          include: { _count: { select: { registrations: true } } },
        },
        _count: { select: { registrations: true } },
      },
    }),
    prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.registration.groupBy({
      by: ["status"],
      where: { schoolId },
      _count: { _all: true },
    }),
    (async () => {
      const gg = await guard("spmb", "manage");
      return !("fail" in gg);
    })(),
  ]);

  const byStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count._all]),
  ) as Record<string, number>;

  const totalRegistrations = statusCounts.reduce((sum, s) => sum + s._count._all, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="border-b-2 border-[var(--ink)] pb-4">
        <p className="text-sm text-[var(--slate)]">Penerimaan Murid Baru</p>
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">SPMB</h1>
        <p className="mt-1 text-sm text-[var(--slate)]">
          Kelola gelombang pendaftaran, jalur masuk, dan seleksi calon murid.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/dashboard/spmb/registrations"
            className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 text-sm hover:border-[var(--ink)]"
          >
            Daftar Pendaftar
          </Link>
          <Link
            href="/dashboard/website"
            className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 text-sm hover:border-[var(--ink)]"
          >
            Teks ajakan di web
          </Link>
        </div>
      </header>

      {/* Ringkasan angka pendaftar — panitia butuh tahu seberapa ramai. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Total pendaftar" value={totalRegistrations} />
        <StatBox label="Menunggu" value={byStatus.PENDING ?? 0} />
        <StatBox label="Diterima" value={byStatus.ACCEPTED ?? 0} tone="good" />
        <StatBox label="Ditolak" value={byStatus.REJECTED ?? 0} />
      </section>

      <BatchList
        batches={batches.map((b) => ({
          id: b.id,
          name: b.name,
          academicYearId: b.academicYearId,
          openDate: b.openDate.toISOString(),
          closeDate: b.closeDate.toISOString(),
          resultDate: b.resultDate?.toISOString() ?? null,
          resultAnnouncement: b.resultAnnouncement ?? null,
          description: b.description,
          requirements: b.requirements,
          quota: b.quota,
          isActive: b.isActive,
          registrationCount: b._count.registrations,
          paths: b.paths.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            description: p.description,
            registrationFee: p.registrationFee,
            quota: p.quota,
            requirements: p.requirements,
            order: p.order,
            isActive: p.isActive,
            filled: p._count.registrations,
          })),
        }))}
        academicYears={academicYears}
        canManage={canManage}
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good";
}) {
  return (
    <div className="border-2 border-[var(--chalk)] bg-white p-3">
      <p className="text-xs text-[var(--slate)]">{label}</p>
      <p
        className="font-display text-2xl font-semibold"
        style={{ color: tone === "good" ? "#047857" : "var(--ink)" }}
      >
        {value}
      </p>
    </div>
  );
}
