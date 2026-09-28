import { wajibKonteksPortal } from "@/lib/portal-akses";
import { pengumumanPortal } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Pengumuman sekolah (postingan yang sudah dipublikasikan). */
export default async function PortalPengumumanPage() {
  const { anak } = await wajibKonteksPortal();
  const daftar = await pengumumanPortal(anak.schoolId);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Pengumuman</h1>

      {daftar.length === 0 ? (
        <p className="text-sm text-slate">Belum ada pengumuman.</p>
      ) : (
        <ul className="space-y-3">
          {daftar.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-chalk bg-white p-5"
            >
              <h2 className="font-display text-lg text-ink">{p.title}</h2>
              {p.publishedAt && (
                <p className="mt-1 text-xs text-slate-light">
                  {formatDate(p.publishedAt)}
                </p>
              )}
              {p.excerpt && (
                <p className="mt-2 text-sm text-slate">{p.excerpt}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
