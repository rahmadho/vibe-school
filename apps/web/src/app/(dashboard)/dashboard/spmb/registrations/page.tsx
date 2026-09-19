import Link from "next/link";
import { guard } from "@/lib/action-guard";
import { prisma } from "@/lib/prisma";
import { RegistrationTable } from "./registration-table";

/**
 * Daftar pendaftar SPMB untuk panitia.
 *
 * Menampilkan JALUR yang dipilih tiap pendaftar — inilah gunanya multi-jalur:
 * panitia bisa menyaring "siapa saja yang mendaftar lewat jalur Prestasi", lalu
 * menyeleksinya terpisah dari jalur Reguler.
 */

export const metadata = { title: "Daftar Pendaftar" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  PENDING: "Menunggu verifikasi",
  VERIFIED: "Dokumen lengkap",
  TESTED: "Sudah seleksi",
  ACCEPTED: "Diterima",
  REJECTED: "Ditolak",
  WAITLIST: "Cadangan",
  WITHDRAWN: "Mengundurkan diri",
};

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: { batch?: string; path?: string; status?: string };
}) {
  const g = await guard("spmb", "read");
  if ("fail" in g) {
    return (
      <div className="mx-auto max-w-md border-2 border-[var(--rule)] bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">
          Tidak dapat diakses
        </p>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          {g.fail.ok ? "Tidak diizinkan." : g.fail.error}
        </p>
      </div>
    );
  }

  const { schoolId } = g.ctx;

  const [batches, registrations, canManage] = await Promise.all([
    prisma.admissionBatch.findMany({
      where: { schoolId },
      orderBy: { openDate: "desc" },
      select: { id: true, name: true, paths: { select: { id: true, name: true } } },
    }),
    prisma.registration.findMany({
      where: {
        schoolId,
        ...(searchParams.batch ? { batchId: searchParams.batch } : {}),
        ...(searchParams.path ? { pathId: searchParams.path } : {}),
        ...(searchParams.status
          ? { status: searchParams.status as never }
          : {}),
      },
      orderBy: { submittedAt: "desc" },
      take: 300,
      include: {
        batch: { select: { name: true } },
        path: { select: { name: true, code: true } },
      },
    }),
    (async () => {
      const gg = await guard("spmb", "manage");
      return !("fail" in gg);
    })(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="border-b-2 border-[var(--ink)] pb-4">
        <p className="text-sm text-[var(--ink-soft)]">
          <Link href="/dashboard/spmb" className="underline">
            SPMB
          </Link>{" "}
          / Daftar Pendaftar
        </p>
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
          Daftar Pendaftar
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          {registrations.length} pendaftar ditampilkan
          {searchParams.path ? " pada jalur terpilih" : ""}.
        </p>
      </header>

      {/* Penyaring — panitia menyeleksi per jalur, jadi ini yang paling sering dipakai. */}
      <form className="flex flex-wrap items-end gap-3 border-2 border-[var(--rule)] bg-white p-4">
        <label className="block text-xs">
          <span className="font-medium text-[var(--ink)]">Gelombang</span>
          <select
            name="batch"
            defaultValue={searchParams.batch ?? ""}
            className="mt-1 border border-[var(--rule)] bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Semua gelombang</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="font-medium text-[var(--ink)]">Jalur</span>
          <select
            name="path"
            defaultValue={searchParams.path ?? ""}
            className="mt-1 border border-[var(--rule)] bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Semua jalur</option>
            {batches.flatMap((b) =>
              b.paths.map((p) => (
                <option key={p.id} value={p.id}>
                  {b.name} · {p.name}
                </option>
              )),
            )}
          </select>
        </label>

        <label className="block text-xs">
          <span className="font-medium text-[var(--ink)]">Status</span>
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="mt-1 border border-[var(--rule)] bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Semua status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="border-2 border-[var(--ink)] bg-[var(--marker)] px-4 py-2 text-sm font-semibold"
        >
          Terapkan
        </button>
        <Link
          href="/dashboard/spmb/registrations"
          className="border-2 border-[var(--rule)] bg-white px-3 py-2 text-sm hover:border-[var(--ink)]"
        >
          Bersihkan
        </Link>
      </form>

      <RegistrationTable
        canManage={canManage}
        rows={registrations.map((r) => ({
          id: r.id,
          registrationNo: r.registrationNo,
          fullName: r.fullName,
          gender: r.gender,
          parentName: r.parentName,
          parentPhone: r.parentPhone,
          status: r.status,
          statusLabel: STATUS_LABEL[r.status] ?? r.status,
          batchName: r.batch.name,
          pathName: r.path?.name ?? null,
          resultNote: r.resultNote,
          submittedAt: r.submittedAt.toISOString(),
        }))}
      />
    </div>
  );
}
