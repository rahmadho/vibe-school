"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Input } from "@/components/ui";
import { Select, Textarea, FormError } from "@/components/form-fields";
import { POST_TYPES, POST_TYPE_LABEL } from "@/lib/validations/site";
import type { ActionResult } from "@/lib/action-result";

/**
 * Form tulis/ubah tulisan konten.
 *
 * Satu form dipakai untuk keempat jenis (berita, pengumuman, agenda, galeri)
 * karena isinya hampir sama. Yang berbeda hanya bagian agenda (tanggal & lokasi
 * kegiatan) yang muncul saat jenis = AGENDA. Menduplikasi form per jenis akan
 * membuat perbaikan kecil harus diulang empat kali.
 */

export type PostType = (typeof POST_TYPES)[number];

export type PostFormValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl: string;
  type: PostType;
  isPublished: boolean;
  publishedAt: string | null;
  eventDate: string | null;
  eventLocation: string;
};

const EMPTY: PostFormValues = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverUrl: "",
  type: "NEWS",
  isPublished: false,
  publishedAt: null,
  eventDate: null,
  eventLocation: "",
};

export function PostForm({
  mode,
  action,
  initial,
}: {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<ActionResult>;
  initial?: PostFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PostFormValues>(initial ?? EMPTY);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  const fe = (n: string) => fieldErrors[n]?.[0];
  const set = <K extends keyof PostFormValues>(k: K, v: PostFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  /** Judul → alamat otomatis sampai operator menyentuh kolom alamat sendiri. */
  function onTitleChange(v: string) {
    setValues((prev) => ({
      ...prev,
      title: v,
      slug: slugTouched ? prev.slug : toSlug(v),
    }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const fd = new FormData();
    if (mode === "edit" && values.id) fd.set("id", values.id);
    fd.set("title", values.title);
    fd.set("slug", values.slug);
    fd.set("excerpt", values.excerpt);
    fd.set("content", values.content);
    fd.set("coverUrl", values.coverUrl);
    fd.set("type", values.type);
    fd.set("isPublished", values.isPublished ? "on" : "");
    fd.set("publishedAt", values.publishedAt ?? "");
    fd.set("eventDate", values.eventDate ?? "");
    fd.set("eventLocation", values.eventLocation);

    const res = await action(fd);
    if (res.ok) {
      router.push("/dashboard/content");
      router.refresh();
      return;
    }
    setError(res.error);
    setFieldErrors(res.fieldErrors ?? {});
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormError message={error} />

      <section className="card space-y-4">
        <h2 className="card-title">Isi tulisan</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Judul" htmlFor="title" error={fe("title")}>
              <Input
                id="title"
                value={values.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Upacara Peringatan Hari Kemerdekaan"
                required
              />
            </Field>
          </div>

          <Field label="Jenis konten" htmlFor="type" error={fe("type")}>
            <Select
              id="type"
              value={values.type}
              onChange={(e) => set("type", e.target.value as PostType)}
            >
              {POST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {POST_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Alamat (slug)"
          htmlFor="slug"
          error={fe("slug")}
        >
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm text-slate">/berita/</span>
            <Input
              id="slug"
              value={values.slug}
              onChange={(e) => {
                set("slug", e.target.value);
                setSlugTouched(true);
              }}
              placeholder="upacara-hari-kemerdekaan"
              className="font-mono"
            />
          </div>
        </Field>

        <Field
          label="Ringkasan (opsional)"
          htmlFor="excerpt"
          error={fe("excerpt")}
        >
          <Textarea
            id="excerpt"
            rows={2}
            value={values.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            placeholder="Satu-dua kalimat yang muncul di daftar berita."
          />
        </Field>

        <Field
          label="Isi lengkap"
          htmlFor="content"
          error={fe("content")}
        >
          <Textarea
            id="content"
            rows={12}
            value={values.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="Tulis isi berita atau pengumuman di sini. Gunakan baris kosong antar paragraf."
          />
        </Field>

        <Field
          label="Gambar sampul (opsional)"
          htmlFor="coverUrl"
          error={fe("coverUrl")}
        >
          <Input
            id="coverUrl"
            value={values.coverUrl}
            onChange={(e) => set("coverUrl", e.target.value)}
            placeholder="/images/kegiatan.jpg atau https://…"
          />
          {/*
            Jujur soal keterbatasan: proyek ini BELUM punya penyimpanan berkas.
            Lebih baik operator tahu harus menempel tautan, daripada mencari
            tombol unggah yang tidak ada.
          */}
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Untuk sementara, tempel tautan gambar (mis. dari Google Drive yang dibagikan
            publik). Unggah langsung akan tersedia setelah penyimpanan berkas dikonfigurasi.
          </p>
        </Field>
      </section>

      {/* Bagian khusus agenda — hanya muncul untuk jenis AGENDA. */}
      {values.type === "AGENDA" && (
        <section className="card space-y-4">
          <h2 className="card-title">Detail agenda</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tanggal kegiatan"
              htmlFor="eventDate"
              error={fe("eventDate")}
            >
              <Input
                id="eventDate"
                type="datetime-local"
                value={values.eventDate ?? ""}
                onChange={(e) => set("eventDate", e.target.value)}
              />
            </Field>
            <Field
              label="Lokasi (opsional)"
              htmlFor="eventLocation"
              error={fe("eventLocation")}
            >
              <Input
                id="eventLocation"
                value={values.eventLocation}
                onChange={(e) => set("eventLocation", e.target.value)}
                placeholder="Aula sekolah"
              />
            </Field>
          </div>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="card-title">Penerbitan</h2>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={values.isPublished}
            onChange={(e) => set("isPublished", e.target.checked)}
            className="h-4 w-4 accent-board"
          />
          Terbitkan tulisan ini
        </label>

        <Field
          label="Jadwal terbit (opsional)"
          htmlFor="publishedAt"
          error={fe("publishedAt")}
        >
          <Input
            id="publishedAt"
            type="datetime-local"
            value={values.publishedAt ?? ""}
            onChange={(e) => set("publishedAt", e.target.value)}
          />
        </Field>
        <p className="text-xs text-slate">
          Kosongkan untuk terbit segera setelah disimpan. Isi tanggal di masa
          depan untuk menerbitkan otomatis pada waktu itu.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Menyimpan…"
            : mode === "create"
              ? "Simpan tulisan"
              : "Simpan perubahan"}
        </Button>
        <Link
          href="/dashboard/content"
          className="inline-flex h-10 items-center rounded border border-chalk bg-white px-4 text-sm text-ink hover:bg-chalk/40"
        >
          Batal
        </Link>
      </div>
    </form>
  );
}

/** "Visi dan Misi" → "visi-dan-misi". */
function toSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}
