import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  listAuditLog,
  getAuditSummary,
  listAuditEntities,
  entityLabel,
  AUDIT_ACTION_LABEL,
} from "@/lib/data/audit";
import { auditFilterSchema } from "@/lib/validations/audit";
import { USER_ROLE_LABEL } from "@/lib/validations/user";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState, Pagination } from "@/components/data-table";

/**
 * Log Aktivitas — jejak siapa mengubah apa.
 *
 * KENAPA HALAMAN INI PENTING (bukan sekadar pelengkap):
 * Saat ada selisih uang atau nilai yang berubah tanpa sebab, pertanyaan
 * pertamanya selalu "siapa yang mengubah, dan jadi berapa?". Tanpa layar ini,
 * jawabannya hanya bisa dicari dengan membuka database langsung — yang tidak
 * bisa dilakukan kepala sekolah.
 *
 * KEPUTUSAN TAMPILAN: setiap baris menampilkan PERUBAHAN NILAI (before → after)
 * pada baris yang bisa dibuka, bukan hanya nama aksi. "UPDATE Invoice" tidak
 * menjawab apa pun; "status: UNPAID → PAID" menjawab.
 */

export const metadata = { title: "Log Aktivitas" };
export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  // `read` sudah cukup — log bersifat catatan, bukan alat kerja harian.
  if (!can(session.user.role, "audit", "read", session.user.permissions)) {
    return (
      <p className="text-slate">Halaman ini hanya untuk pengelola sekolah.</p>
    );
  }

  const schoolId = session.user.schoolId;
  const sp = await searchParams;

  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const filter = auditFilterSchema.parse({
    q: str("q"),
    action: str("action"),
    entity: str("entity"),
    from: str("from"),
    to: str("to"),
    page: sp.page ?? 1,
    perPage: sp.perPage ?? 25,
  });

  const [result, summary, entities] = await Promise.all([
    listAuditLog(schoolId, filter),
    getAuditSummary(schoolId),
    listAuditEntities(schoolId),
  ]);

  const filtered = Boolean(
    filter.q || filter.action || filter.entity || filter.from || filter.to,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log Aktivitas"
        context={
          summary.total === 0
            ? "Belum ada aktivitas tercatat"
            : `${summary.total.toLocaleString("id-ID")} catatan · ${summary.actors} pelaku` +
              (summary.oldest ? ` · sejak ${formatDate(summary.oldest)}` : "")
        }
      />

      {/* Ringkasan per jenis aksi. Angka bermakna: lonjakan HAPUS atau EKSPOR
          adalah hal yang wajar untuk diperiksa. */}
      {summary.total > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(AUDIT_ACTION_LABEL).map(([key, label]) => (
            <li
              key={key}
              className="rounded-lg border border-chalk bg-white px-3 py-2.5"
            >
              <p className="tabular-display text-xl text-ink">
                {(summary.byAction[key] ?? 0).toLocaleString("id-ID")}
              </p>
              <p className="mt-0.5 text-xs text-slate">{label}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
        action="/dashboard/audit"
      >
        <div className="min-w-[180px] flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate">
            Cari
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="Nama pelaku atau jenis data"
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          />
        </div>

        <div className="w-40">
          <label htmlFor="action" className="mb-1 block text-xs font-medium text-slate">
            Jenis aksi
          </label>
          <select
            id="action"
            name="action"
            defaultValue={filter.action ?? ""}
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          >
            <option value="">Semua aksi</option>
            {Object.entries(AUDIT_ACTION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="w-44">
          <label htmlFor="entity" className="mb-1 block text-xs font-medium text-slate">
            Jenis data
          </label>
          <select
            id="entity"
            name="entity"
            defaultValue={filter.entity ?? ""}
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          >
            <option value="">Semua jenis</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {entityLabel(e)}
              </option>
            ))}
          </select>
        </div>

        <div className="w-40">
          <label htmlFor="from" className="mb-1 block text-xs font-medium text-slate">
            Dari tanggal
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={filter.from ?? ""}
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          />
        </div>

        <div className="w-40">
          <label htmlFor="to" className="mb-1 block text-xs font-medium text-slate">
            Sampai tanggal
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={filter.to ?? ""}
            className="h-10 w-full rounded border border-chalk bg-white px-3 text-sm focus:border-board focus:outline-none"
          />
        </div>

        <Button type="submit">Terapkan</Button>

        {filtered ? (
          <a
            href="/dashboard/audit"
            className="text-sm text-slate underline hover:text-ink"
          >
            Bersihkan
          </a>
        ) : null}
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title={filtered ? "Tidak ada catatan yang cocok" : "Belum ada aktivitas"}
          description={
            filtered
              ? "Coba longgarkan filter — misalnya perluas rentang tanggalnya."
              : "Setiap penambahan, perubahan, dan penghapusan data penting akan tercatat di sini secara otomatis."
          }
        />
      ) : (
        <>
          <Table
            head={
              <>
                <th className="w-40">Waktu</th>
                <th className="w-44">Pelaku</th>
                <th className="w-24">Aksi</th>
                <th className="w-40">Jenis data</th>
                <th>Perubahan</th>
              </>
            }
          >
            {result.items.map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap text-xs text-slate">
                  {row.createdAt.toLocaleString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td>
                  {row.user ? (
                    <>
                      <span className="block truncate font-medium text-ink">
                        {row.user.name}
                      </span>
                      <span className="text-xs text-slate">
                        {USER_ROLE_LABEL[row.user.role]}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate">Sistem / publik</span>
                  )}
                </td>
                <td>
                  <ActionMarker action={row.action} />
                </td>
                <td>
                  <span className="text-slate">{entityLabel(row.entity)}</span>
                  {row.entityId ? (
                    <span className="ml-1 font-mono text-[11px] text-slate-light">
                      {row.entityId.slice(0, 8)}
                    </span>
                  ) : null}
                </td>
                <td>
                  <ChangeSummary
                    action={row.action}
                    before={row.before}
                    after={row.after}
                  />
                </td>
              </tr>
            ))}
          </Table>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/dashboard/audit"
            itemLabel="catatan"
            params={{
              q: filter.q,
              action: filter.action,
              entity: filter.entity,
              from: filter.from,
              to: filter.to,
              perPage: String(filter.perPage),
            }}
          />
        </>
      )}
    </div>
  );
}

/** Penanda aksi: titik + label. Warna hanya untuk makna. */
function ActionMarker({ action }: { action: keyof typeof AUDIT_ACTION_LABEL }) {
  const tone =
    action === "DELETE"
      ? "bg-marker"
      : action === "CREATE"
        ? "bg-board"
        : action === "LOGIN" || action === "LOGOUT"
          ? "bg-slate-light"
          : "bg-slate";
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      <span className="text-ink">{AUDIT_ACTION_LABEL[action]}</span>
    </span>
  );
}

/**
 * Ringkas perubahan nilai: "status: UNPAID → PAID".
 *
 * Field yang tidak berubah sengaja TIDAK ditampilkan — kalau seluruh payload
 * ditampilkan, yang penting justru tenggelam. Maksimal tiga field supaya baris
 * tabel tetap terbaca; sisanya dihitung sebagai "+N lainnya".
 */
function ChangeSummary({
  action,
  before,
  after,
}: {
  action: string;
  before: unknown;
  after: unknown;
}) {
  const b = asRecord(before);
  const a = asRecord(after);

  if (action === "CREATE") {
    const keys = Object.keys(a);
    if (keys.length === 0) return <span className="text-xs text-slate">—</span>;
    return (
      <span className="text-xs text-slate">
        {keys.slice(0, 3).map((k) => `${k}: ${short(a[k])}`).join(" · ")}
        {keys.length > 3 ? ` · +${keys.length - 3} lainnya` : ""}
      </span>
    );
  }

  if (action === "DELETE") {
    const keys = Object.keys(b);
    if (keys.length === 0) return <span className="text-xs text-slate">Data dihapus</span>;
    return (
      <span className="text-xs text-slate">
        Dihapus — {keys.slice(0, 3).map((k) => `${k}: ${short(b[k])}`).join(" · ")}
      </span>
    );
  }

  const changed = Object.keys(a).filter(
    (k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]),
  );

  if (changed.length === 0) {
    return <span className="text-xs text-slate-light">Tidak ada perubahan nilai</span>;
  }

  return (
    <span className="text-xs text-slate">
      {changed.slice(0, 3).map((k, i) => (
        <span key={k}>
          {i > 0 ? " · " : ""}
          <span className="text-slate-light">{k}:</span>{" "}
          <span className="text-ink">{short(b[k])}</span>
          {" → "}
          <span className="font-medium text-ink">{short(a[k])}</span>
        </span>
      ))}
      {changed.length > 3 ? ` · +${changed.length - 3} lainnya` : ""}
    </span>
  );
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/** Nilai pendek untuk ditampilkan di dalam baris tabel. */
function short(v: unknown): string {
  if (v === null || v === undefined) return "kosong";
  if (typeof v === "boolean") return v ? "ya" : "tidak";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 28 ? `${s.slice(0, 28)}…` : s;
}
