import Link from "next/link";
import { guard } from "@/lib/action-guard";
import { listMedia } from "@/lib/data/media";
import { isAiReady } from "@/lib/data/ai";
import { PostForm } from "../post-form";
import { createPost } from "../actions";

/**
 * Halaman tulis konten baru.
 *
 * Satu halaman untuk keempat jenis. Operator memilih jenisnya di form, bukan
 * di menu terpisah — karena mereka sering baru tahu "ini sebenarnya
 * pengumuman, bukan berita" sambil menulis.
 */
export const metadata = { title: "Tulis Baru" };

export default async function NewPostPage() {
  const g = await guard("content", "manage");
  if ("fail" in g) {
    return (
      <div className="mx-auto max-w-md border-2 border-[var(--chalk)] bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">
          Tidak dapat diakses
        </p>
        <p className="mt-2 text-sm text-[var(--slate)]">
          {g.fail.ok ? "Anda tidak memiliki izin menulis konten." : g.fail.error}
        </p>
        <Link href="/dashboard/content" className="mt-4 inline-block text-sm underline">
          ← Kembali ke daftar
        </Link>
      </div>
    );
  }

  // Pustaka media (untuk pemilih sampul) dan kesiapan AI diambil bersamaan.
  // Hanya kolom yang dipakai yang dikirim — objek Prisma utuh akan membawa
  // kolom internal ke HTML tanpa alasan.
  const [media, aiEnabled] = await Promise.all([
    listMedia(g.ctx.schoolId),
    isAiReady(g.ctx.schoolId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b-2 border-[var(--ink)] pb-3">
        <p className="text-sm text-[var(--slate)]">
          <Link href="/dashboard/content" className="underline">
            Berita &amp; Pengumuman
          </Link>{" "}
          / Tulis Baru
        </p>
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
          Tulis Baru
        </h1>
      </header>

      <PostForm
        mode="create"
        action={createPost}
        aiEnabled={aiEnabled}
        media={media.map((m) => ({
          id: m.id,
          name: m.name,
          url: m.url,
          width: m.width,
          height: m.height,
        }))}
      />
    </div>
  );
}
