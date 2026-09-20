import type { ReactNode } from "react";

/**
 * Komponen presentasional untuk halaman data master.
 * Desain: seperti "buku induk" — tabel jadi alat kerja utama.
 */

/** Header halaman: judul + konteks + aksi. Tanpa eyebrow ALL-CAPS. */
export function PageHeader({
  title,
  context,
  actions,
}: {
  title: string;
  context?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl text-ink">{title}</h1>
        {context ? <p className="mt-1 text-sm text-slate">{context}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Penanda status: titik warna kecil + label.
 * Dipakai hemat; hanya warna yang punya makna (aktif/perhatian/nonaktif).
 */
const STATUS_TONE: Record<string, "ok" | "warn" | "muted"> = {
  ACTIVE: "ok",
  GRADUATED: "muted",
  TRANSFERRED: "muted",
  DROPPED_OUT: "warn",
  SUSPENDED: "warn",
};

const TONE_CLASS: Record<string, string> = {
  ok: "bg-board",
  warn: "bg-marker",
  muted: "bg-slate-light",
};

export function StatusMarker({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const tone = STATUS_TONE[status] ?? "muted";
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${TONE_CLASS[tone]}`}
      />
      <span className="text-ink">{label}</span>
    </span>
  );
}

/** Header tabel bergaya buku induk. */
export function Table({
  head,
  children,
}: {
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-chalk bg-white">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>{head}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Empty state: ajakan bertindak, bukan sekadar "tidak ada data". */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-chalk bg-white px-6 py-12 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-prose text-sm text-slate">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * Pagination. Membangun URL dari query saat ini agar filter tidak hilang.
 */
export function Pagination({
  page,
  totalPages,
  total,
  basePath,
  params,
  itemLabel = "data",
}: {
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
  /** Kata benda untuk baris hitungan, mis. "siswa" atau "catatan". */
  itemLabel?: string;
}) {
  const build = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const from = total === 0 ? 0 : (page - 1) * (params.perPage ? Number(params.perPage) : 20) + 1;
  const to = Math.min(total, from + (params.perPage ? Number(params.perPage) : 20) - 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate">
      <p>
        Menampilkan {from}–{to} dari {total} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <PageLink href={build(page - 1)} disabled={page <= 1}>
          Sebelumnya
        </PageLink>
        <span className="px-1">
          Halaman {page} / {totalPages}
        </span>
        <PageLink href={build(page + 1)} disabled={page >= totalPages}>
          Berikutnya
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded border border-chalk px-3 py-1.5 text-slate-light">
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      className="rounded border border-chalk px-3 py-1.5 text-ink hover:bg-chalk/40"
    >
      {children}
    </a>
  );
}
