import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listQueue, getQueueStats } from "@/lib/data/notifications";
import {
  QUEUE_STATUSES,
  QUEUE_STATUS_LABEL,
  type QueueStatusValue,
} from "@/lib/notification-labels";
import { QueueRow } from "../queue-row";
import { QueueBulkActions } from "../notify-client";
import { Pagination } from "@/components/data-table";

export const dynamic = "force-dynamic";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "notifications", "read")) redirect("/dashboard");

  const sp = await searchParams;
  const schoolId = session.user.schoolId as string;
  const status = sp.status ?? "ALL";
  const page = sp.page ? Number(sp.page) : 1;
  const perPage = 30;

  const [queue, stats] = await Promise.all([
    listQueue(schoolId, {
      status,
      search: sp.q,
      take: perPage,
      skip: (page - 1) * perPage,
    }),
    getQueueStats(schoolId),
  ]);

  const canManage = can(session.user.role, "notifications", "manage");

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "ALL", label: "Semua", count: stats.total },
    ...QUEUE_STATUSES.map((s) => ({
      key: s,
      label: QUEUE_STATUS_LABEL[s as QueueStatusValue],
      count: {
        QUEUED: stats.queued,
        PROCESSING: stats.processing,
        SENT: stats.sent,
        FAILED: stats.failed,
        CANCELLED: stats.cancelled,
      }[s],
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/notifications"
          className="text-sm text-slate underline-offset-2 hover:underline"
        >
          ← Notifikasi
        </Link>
        <h1 className="mt-2 font-serif text-2xl text-ink">Antrean pengiriman</h1>
        <p className="mt-1 text-sm text-slate">
          {stats.successRate}% pesan berhasil terkirim dari {stats.total} pesan.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1">
          {tabs.map((t) => {
            const active = t.key === status;
            return (
              <Link
                key={t.key}
                href={`/dashboard/notifications/queue?status=${t.key}`}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-chalk bg-paper text-ink hover:bg-board/60"
                }`}
              >
                {t.label}
                <span className="ml-1.5 font-mono text-xs tabular-nums opacity-70">
                  {t.count}
                </span>
              </Link>
            );
          })}
        </nav>

        <form className="flex gap-2" action="/dashboard/notifications/queue">
          <input type="hidden" name="status" value={status} />
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Cari nomor atau isi pesan…"
            className="rounded-md border border-chalk bg-paper px-3 py-1.5 text-sm text-ink"
          />
          <button
            type="submit"
            className="rounded-md border border-chalk bg-paper px-3 py-1.5 text-sm text-ink hover:bg-board/60"
          >
            Cari
          </button>
        </form>
      </div>

      {canManage && (
        <QueueBulkActions
          canManage={canManage}
          failedCount={stats.failed}
          queuedCount={stats.queued}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-chalk bg-white">
        {queue.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate">
            Tidak ada pesan pada filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-48">Penerima</th>
                  <th>Isi pesan</th>
                  <th className="w-36">Status</th>
                  <th className="w-44">Percobaan</th>
                  {canManage && <th className="w-28 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {queue.map((row) => (
                  <QueueRow key={row.id} row={row} canManage={canManage} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(() => {
        const total =
          status === "ALL"
            ? stats.total
            : (stats[status.toLowerCase() as keyof typeof stats] as number) ??
              queue.length;
        const totalPages = Math.max(1, Math.ceil(total / perPage));

        return (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            basePath="/dashboard/notifications/queue"
            params={{
              status: sp.status,
              q: sp.q,
            }}
            itemLabel="pesan"
          />
        );
      })()}
    </div>
  );
}
