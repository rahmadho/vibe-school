import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { daftarPublikasiNilai } from "@/lib/data/grade-publication";
import { PageHeader, EmptyState } from "@/components/data-table";
import { formatDate } from "@/lib/format";
import { PublishForm, UnpublishButton } from "./publish-client";

export const metadata = { title: "Publikasi Nilai" };
export const dynamic = "force-dynamic";

export default async function PublikasiNilaiPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "grades", "read", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya akses ke modul penilaian.</p>;
  }
  const canManage = can(session.user.role, "grades", "manage", session.user.permissions);

  const { classes, semesters, publications } = await daftarPublikasiNilai(schoolId);
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const semesterLabel = new Map(
    semesters.map((s) => [s.id, `${s.name} · ${s.academicYear.name}`]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publikasi Nilai"
        context="Bagikan nilai akhir semester ke orang tua lewat WhatsApp dan portal."
      />

      {canManage ? (
        <section className="rounded-xl border border-chalk bg-white p-5">
          <h2 className="font-display text-lg text-ink">Publikasikan kelas</h2>
          <p className="mt-1 text-xs text-slate">
            Rapor harus sudah dihitung (Penilaian → Rekap &amp; Rapor). Pesan masuk antrean
            WhatsApp dan dikirim worker — bukan saat tombol ditekan.
          </p>
          <div className="mt-4">
            <PublishForm
              classes={classes}
              semesters={semesters.map((s) => ({
                id: s.id,
                label: `${s.name} · ${s.academicYear.name}`,
              }))}
            />
          </div>
        </section>
      ) : (
        <p className="text-xs text-slate">Hanya admin sekolah yang dapat mempublikasikan nilai.</p>
      )}

      <section className="rounded-xl border border-chalk bg-white">
        {publications.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Belum ada publikasi"
              description="Publikasi yang diterbitkan akan tercatat di sini."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chalk text-left text-xs uppercase text-slate-light">
                <th className="px-5 py-3">Kelas</th>
                <th className="px-5 py-3">Semester</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Siswa / Pesan</th>
                <th className="px-5 py-3">Terbit</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {publications.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 text-ink">{className.get(p.classId) ?? "-"}</td>
                  <td className="px-5 py-3 text-slate">{semesterLabel.get(p.semesterId) ?? "-"}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        p.status === "PUBLISHED" ? "text-board" : "text-slate-light"
                      }
                    >
                      {p.status === "PUBLISHED" ? "Terbit" : "Draf"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate">
                    {p.studentCount} / {p.recipientCount}
                  </td>
                  <td className="px-5 py-3 text-slate-light">
                    {p.publishedAt ? formatDate(p.publishedAt) : "-"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canManage && p.status === "PUBLISHED" ? (
                      <UnpublishButton id={p.id} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
