import Link from "next/link";
import { notFound } from "next/navigation";
import { guard } from "@/lib/action-guard";
import { getPostForAdmin } from "@/lib/data/content";
import { listMedia } from "@/lib/data/media";
import { isAiReady } from "@/lib/data/ai";
import { PostForm } from "../../post-form";
import { updatePost } from "../../actions";

/**
 * Halaman ubah konten.
 *
 * Tanggal terbit dikirim apa adanya ke form supaya operator melihat kapan
 * tulisan pertama kali terbit — dan tidak mengiranya berubah setiap kali ia
 * memperbaiki salah ketik.
 */
export const metadata = { title: "Ubah Konten" };

// Next.js 15: `params` adalah Promise dan WAJIB di-await. `tsc --noEmit`
// tidak menangkap ini — hanya `next build` yang memeriksanya.
export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard("content", "manage");
  if ("fail" in g) {
    return (
      <div className="mx-auto max-w-md border-2 border-[var(--chalk)] bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">
          Tidak dapat diakses
        </p>
        <p className="mt-2 text-sm text-[var(--slate)]">
          {g.fail.ok ? "Anda tidak memiliki izin mengubah konten." : g.fail.error}
        </p>
      </div>
    );
  }

  // Tiga query independen — dijalankan bersamaan.
  const [post, media, aiEnabled] = await Promise.all([
    getPostForAdmin(g.ctx.schoolId, id),
    listMedia(g.ctx.schoolId),
    isAiReady(g.ctx.schoolId),
  ]);

  // Tulisan sekolah lain terlihat sama saja dengan "tidak ada" — tidak ada
  // gunanya memberi tahu penyerang bahwa ID-nya benar tapi milik sekolah lain.
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b-2 border-[var(--ink)] pb-3">
        <p className="text-sm text-[var(--slate)]">
          <Link href="/dashboard/content" className="underline">
            Berita &amp; Pengumuman
          </Link>{" "}
          / Ubah
        </p>
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
          {post.title}
        </h1>
      </header>

      <PostForm
        mode="edit"
        action={updatePost}
        aiEnabled={aiEnabled}
        media={media.map((m) => ({
          id: m.id,
          name: m.name,
          url: m.url,
          width: m.width,
          height: m.height,
        }))}
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          content: post.content,
          coverUrl: post.coverUrl ?? "",
          type: post.type,
          isPublished: post.isPublished,
          publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
          eventDate: post.eventDate ? post.eventDate.toISOString() : null,
          eventLocation: post.eventLocation ?? "",
        }}
      />
    </div>
  );
}
