import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listCampaigns } from "@/lib/data/notifications";
import { AUDIENCE_LABEL, type AudienceTypeValue } from "@/lib/validations/notification";
import { AnnouncementForm } from "./announcement-form";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "notifications", "manage")) redirect("/dashboard");

  const schoolId = session.user.schoolId as string;

  const [classes, campaigns, school] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listCampaigns(schoolId),
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/notifications"
          className="text-sm text-slate underline-offset-2 hover:underline"
        >
          ← Notifikasi
        </Link>
        <h1 className="mt-2 font-serif text-2xl text-ink">Kirim pengumuman</h1>
        <p className="mt-1 text-sm text-slate">
          Kirim satu pesan ke banyak orang tua, siswa, atau guru sekaligus.
        </p>
      </div>

      <section className="rounded-lg border border-chalk bg-paper p-4">
        <AnnouncementForm
          classes={classes}
          schoolName={school?.name ?? "Sekolah"}
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-chalk bg-paper">
        <div className="border-b border-chalk px-4 py-3">
          <h2 className="font-medium text-ink">Riwayat pengumuman</h2>
        </div>
        {campaigns.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate">
            Belum ada pengumuman yang dikirim.
          </p>
        ) : (
          <div className="divide-y divide-chalk">
            {campaigns.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{c.title}</span>
                  <span className="text-xs text-slate">
                    {new Date(c.createdAt).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate">
                  <span>
                    {AUDIENCE_LABEL[c.audienceType as AudienceTypeValue] ??
                      c.audienceType}
                  </span>
                  {c.audienceClass && <span>· {c.audienceClass.name}</span>}
                  <span className="font-mono tabular-nums">
                    · {c.recipientCount} penerima
                  </span>
                  {c.createdBy && <span>· oleh {c.createdBy.name}</span>}
                </div>
                <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate/80">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
