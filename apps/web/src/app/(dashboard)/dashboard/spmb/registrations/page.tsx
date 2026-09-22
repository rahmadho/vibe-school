import Link from "next/link";
import { guard } from "@/lib/action-guard";
import { prisma } from "@/lib/prisma";
import { Pagination } from "@/components/data-table";
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
  // Next.js 15: `searchParams` juga Promise.
  searchParams: Promise<{ batch?: string; path?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;
  const perPage = 25;
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

  const regWhere = {
    schoolId,
    ...(sp.batch ? { batchId: sp.batch } : {}),
    ...(sp.path ? { pathId: sp.path } : {}),
    ...(sp.status ? { status: sp.status as never } : {}),
  };

  const [batches, registrations, total, canManage, classes, majors] = await Promise.all([
    prisma.admissionBatch.findMany({
      where: { schoolId },
      orderBy: { openDate: "desc" },
      select: { id: true, name: true, paths: { select: { id: true, name: true, code: true } } },
    }),
    prisma.registration.findMany({
      where: regWhere,
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        batch: { select: { name: true } },
        path: { select: { name: true, code: true } },
        major: { select: { id: true, name: true } },
      },
    }),
    prisma.registration.count({ where: regWhere }),
    (async () => {
      const gg = await guard("spmb", "manage");
      return !("fail" in gg);
    })(),
    // Kelas tahun ajaran aktif — untuk penempatan saat konversi ke siswa.
    prisma.class.findMany({
      where: { schoolId, deletedAt: null, academicYear: { isActive: true } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.major.findMany({
      where: { schoolId, deletedAt: null, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="border-b-2 border-[var(--ink)] pb-4">
        <p className="text-sm text-[var(--slate)]">
          <Link href="/dashboard/spmb" className="underline">
            SPMB
          </Link>{" "}
          / Daftar Pendaftar
        </p>
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
          Daftar Pendaftar
        </h1>
        <p className="mt-1 text-sm text-[var(--slate)]">
          {registrations.length} pendaftar ditampilkan
          {sp.path ? " pada jalur terpilih" : ""}.
        </p>
      </header>

      {/* Penyaring — panitia menyeleksi per jalur, jadi ini yang paling sering dipakai. */}
      <form className="flex flex-wrap items-end gap-3 border-2 border-[var(--chalk)] bg-white p-4">
        <label className="block text-xs">
          <span className="font-medium text-[var(--ink)]">Gelombang</span>
          <select
            name="batch"
            defaultValue={sp.batch ?? ""}
            className="mt-1 border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
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
            defaultValue={sp.path ?? ""}
            className="mt-1 border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
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
            defaultValue={sp.status ?? ""}
            className="mt-1 border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
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
          className="border-2 border-[var(--chalk)] bg-white px-3 py-2 text-sm hover:border-[var(--ink)]"
        >
          Bersihkan
        </Link>
      </form>

      <RegistrationTable
        canManage={canManage}
        classes={classes}
        majors={majors}
        batches={batches.map((b) => ({
          id: b.id,
          name: b.name,
          paths: b.paths.map((p) => ({ id: p.id, name: p.name, code: p.code })),
        }))}
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
          majorName: r.major?.name ?? null,
          source: r.source,
          docs: {
            docBirthCert: r.docBirthCert,
            docFamilyCard: r.docFamilyCard,
            docPhoto: r.docPhoto,
            docDiploma: r.docDiploma,
          },
          isConverted: Boolean(r.studentId),
          resultNote: r.resultNote,
          submittedAt: r.submittedAt.toISOString(),
        }))}
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/dashboard/spmb/registrations"
        params={{
          batch: sp.batch,
          path: sp.path,
          status: sp.status,
        }}
        itemLabel="pendaftar"
      />
    </div>
  );
}
