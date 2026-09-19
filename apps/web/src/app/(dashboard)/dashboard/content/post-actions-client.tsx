"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePost, togglePostPublished } from "./actions";

/**
 * Tombol hapus dengan konfirmasi.
 *
 * Hapus = soft delete (diisi `deletedAt`), jadi tulisan sebenarnya masih ada di
 * database dan bisa dipulihkan. Konfirmasi tetap dipakai supaya operator tidak
 * menghapus karena salah klik dan bingung mencari tulisan yang hilang.
 */
export function DeletePostButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deletePost(fd);
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-marker underline"
      >
        Hapus
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-slate">Hapus “{title}”?</span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded border border-marker px-2 py-0.5 font-medium text-marker disabled:opacity-50"
      >
        {pending ? "…" : "Ya, hapus"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="rounded border border-chalk px-2 py-0.5 text-slate"
      >
        Batal
      </button>
    </span>
  );
}

/** Tombol terbitkan/tarik ke draf langsung dari daftar. */
export function PublishToggle({
  id,
  isPublished,
}: {
  id: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await togglePostPublished(fd);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="rounded border border-chalk px-2 py-0.5 text-xs text-slate hover:border-board hover:text-board disabled:opacity-50"
    >
      {pending ? "…" : isPublished ? "Jadikan draf" : "Terbitkan"}
    </button>
  );
}
