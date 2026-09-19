import Link from "next/link";
import { guard } from "@/lib/action-guard";
import { POST_TYPES, type PostTypeValue } from "@/lib/validations/site";
import { listPostsForAdmin, countPostsByStatus } from "@/lib/data/content";
import { Stat } from "@/components/ui";
import { ContentFilters } from "./content-filters";
import { DeletePostButton, PublishToggle } from "./post-actions-client";

/**
 * Daftar konten web sekolah — berita, pengumuman, agenda, galeri.
 *
 * Satu daftar untuk keempat jenis dengan filter, bukan empat menu terpisah:
 * pengelola konten sekolah biasanya satu orang, dan berpindah menu untuk
 * memeriksa "apa saja yang sedang tayang" membuat pekerjaan lambat.
 */

export const metadata = { title: "Konten" };
export const dynamic = "force-dynamic";

const TYPE_BADGE: Record<PostTypeValue, string> = {
  NEWS: "Berita",
  ANNOUNCEMENT: "Pengumuman",
  AGENDA: "Agenda",
  GALLERY: "Galeri",
};

type SearchParams = Promise<{
  q?: string;
  type?: string;
  status?: string;
}>;

export default async function ContentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const g = await guard("content", "read");
  if ("fail" in g) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-display text-lg text-ink">Tidak dapat diakses</p>
        <p className="mt-2 text-sm text-slate">
          {g.fail.ok ? "Tidak diizinkan." : g.fail.error}
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const type =
    sp.type && (POST_TYPES as readonly string[]).includes(sp.type)
      ? (sp.type as PostTypeValue)
      : undefined;
  const status =
    sp.status === "draft" || sp.status === "published" || sp.status === "scheduled"
      ? sp.status
      : undefined;

  const schoolId = g.ctx.schoolId;
  const [posts, counts] = await Promise.all([
    listPostsForAdmin(schoolId, { type, status, search: sp.q?.trim() }),
    countPostsByStatus(schoolId),
  ]);

  const now = new Date();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Konten</h1>
          <p className="mt-1 text-slate">
            Kelola berita, pengumuman, agenda, dan galeri yang tampil di web
            sekolah.
          </p>
        </div>
        <Link
          href="/dashboard/content/new"
          className="inline-flex h-10 items-center rounded bg-board px-4 text-sm font-medium text-white hover:bg-board-dark"
        >
          Tulis baru
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat value={counts.total} label="Total tulisan" />
        <Stat value={counts.published} label="Terbit" />
        <Stat value={counts.draft} label="Draf" />
        <Stat value={counts.scheduled} label="Terjadwal" hint="terbit otomatis" />
      </div>

      <ContentFilters
        current={{ q: sp.q ?? "", type: sp.type ?? "", status: sp.status ?? "" }}
      />

      {posts.length === 0 ? (
        <div className="card text-center">
          <p className="font-medium text-ink">Belum ada tulisan</p>
          <p className="mt-1 text-sm text-slate">
            Mulai dengan menulis berita atau pengumuman pertama.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden border-2 border-[var(--chalk)] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-chalk bg-chalk/30 text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-2 font-medium">Judul</th>
                <th className="px-4 py-2 font-medium">Jenis</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Diperbarui</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-chalk">
              {posts.map((p) => {
                const scheduled =
                  p.isPublished && p.publishedAt !== null && p.publishedAt > now;
                return (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/content/${p.id}/edit`}
                        className="font-medium text-ink hover:text-board"
                      >
                        {p.title}
                      </Link>
                      <p className="mt-0.5 font-mono text-xs text-slate-light">
                        /{p.slug}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate">{TYPE_BADGE[p.type]}</td>
                    <td className="px-4 py-3">
                      <StatusBadge isPublished={p.isPublished} scheduled={scheduled} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate">
                      {formatDate(p.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <PublishToggle id={p.id} isPublished={p.isPublished} />
                        <Link
                          href={`/dashboard/content/${p.id}/edit`}
                          className="rounded border border-chalk px-2 py-0.5 text-xs text-slate hover:border-board hover:text-board"
                        >
                          Ubah
                        </Link>
                        <DeletePostButton id={p.id} title={p.title} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  isPublished,
  scheduled,
}: {
  isPublished: boolean;
  scheduled: boolean;
}) {
  if (!isPublished) {
    return (
      <span className="rounded border border-chalk bg-chalk/30 px-2 py-0.5 text-xs text-slate">
        Draf
      </span>
    );
  }
  if (scheduled) {
    return (
      <span className="rounded border border-marker/40 bg-marker/10 px-2 py-0.5 text-xs text-marker">
        Terjadwal
      </span>
    );
  }
  return (
    <span className="rounded border border-board/30 bg-board/10 px-2 py-0.5 text-xs text-board">
      Terbit
    </span>
  );
}

/** Format tanggal ringkas bahasa Indonesia. */
function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
