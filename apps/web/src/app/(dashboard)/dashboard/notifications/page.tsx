import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getQueueStats, listQueue, listTemplates } from "@/lib/data/notifications";
import { gatewayConfigured } from "@/lib/gateway-web";
import { QUEUE_STATUS_LABEL, QUEUE_STATUS_TONE } from "@/lib/notification-labels";
import { Stat } from "@/components/ui";
import { TestSendForm, QueueBulkActions } from "./notify-client";
import { QueueRow } from "./queue-row";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "notifications", "read")) redirect("/dashboard");

  const schoolId = session.user.schoolId as string;
  const [stats, queue, templates] = await Promise.all([
    getQueueStats(schoolId),
    listQueue(schoolId, { take: 12 }),
    listTemplates(schoolId),
  ]);

  const canManage = can(session.user.role, "notifications", "manage");
  const configured = gatewayConfigured();
  const activeTemplates = templates.filter((t) => t.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Notifikasi WhatsApp</h1>
          <p className="mt-1 text-sm text-slate">
            Antrean pengiriman, template pesan, dan status koneksi WhatsApp sekolah.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/notifications/whatsapp"
            className="rounded-md border border-chalk bg-paper px-3 py-2 text-sm text-ink hover:bg-board/60"
          >
            Koneksi WhatsApp
          </Link>
          <Link
            href="/dashboard/notifications/templates"
            className="rounded-md border border-chalk bg-paper px-3 py-2 text-sm text-ink hover:bg-board/60"
          >
            Template pesan
          </Link>
          <Link
            href="/dashboard/notifications/announcements"
            className="rounded-md bg-ink px-3 py-2 text-sm text-paper hover:bg-ink/90"
          >
            Kirim pengumuman
          </Link>
        </div>
      </div>

      {!configured && (
        <div className="rounded-lg border border-marker/40 bg-marker/5 p-4 text-sm text-ink">
          <p className="font-medium">Token gateway belum diatur</p>
          <p className="mt-1 text-slate">
            Isi <code className="rounded bg-board px-1">WA_GATEWAY_TOKEN</code> pada{" "}
            <code className="rounded bg-board px-1">apps/web/.env</code> agar pesan
            dapat dikirim. Template dan pengumuman tetap bisa dibuat sekarang.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Menunggu antrean" value={stats.queued} hint="siap dikirim" />
        <Stat label="Terkirim" value={stats.sent} hint="sepanjang waktu" />
        <Stat
          label="Gagal"
          value={stats.failed}
          hint={`${stats.successRate}% berhasil`}
        />
        <Stat
          label="Template aktif"
          value={`${activeTemplates}/${templates.length}`}
          hint="pesan siap pakai"
        />
      </div>

      {stats.processing > 0 && (
        <p className="text-sm text-slate">
          {stats.processing} pesan sedang diproses worker saat ini.
        </p>
      )}

      <div className="rounded-lg border border-chalk bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-chalk px-4 py-3">
          <h2 className="font-medium text-ink">Antrean terbaru</h2>
          <div className="flex items-center gap-2">
            <QueueBulkActions canManage={canManage} />
            <Link
              href="/dashboard/notifications/queue"
              className="text-sm text-slate underline-offset-2 hover:underline"
            >
              Lihat semua
            </Link>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate">
              Belum ada pesan dalam antrean. Notifikasi absensi, tagihan, dan nilai
              akan otomatis masuk ke sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-board/60 text-left text-xs uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-2 font-medium">Penerima</th>
                  <th className="px-4 py-2 font-medium">Isi pesan</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Percobaan</th>
                  {canManage && <th className="px-4 py-2 font-medium">Aksi</th>}
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

      {canManage && (
        <div className="grid gap-4 lg:grid-cols-2">
          <TestSendForm />
          <div className="rounded-lg border border-chalk bg-paper p-4">
            <h2 className="font-medium text-ink">Status antrean</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(
                ["QUEUED", "PROCESSING", "SENT", "FAILED", "CANCELLED"] as const
              ).map((s) => (
                <li key={s} className="flex items-center justify-between">
                  <span className={QUEUE_STATUS_TONE[s]}>{QUEUE_STATUS_LABEL[s]}</span>
                  <span className="font-mono tabular-nums text-ink">
                    {
                      {
                        QUEUED: stats.queued,
                        PROCESSING: stats.processing,
                        SENT: stats.sent,
                        FAILED: stats.failed,
                        CANCELLED: stats.cancelled,
                      }[s]
                    }
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-chalk pt-3 text-xs text-slate">
              Pesan ditahan di luar jam wajar (07.00–20.00, Senin–Sabtu) agar orang
              tua tidak menerima notifikasi tengah malam.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
