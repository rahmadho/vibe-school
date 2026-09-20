"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, Textarea, FormError } from "@/components/form-fields";
import {
  GENDERS,
  GENDER_LABEL,
} from "@/lib/validations/personnel";
import type { ActionResult } from "@/lib/action-result";

/**
 * Form guru — create & edit.
 * `subjectIds` dikirim sebagai multiple input (checkbox) dengan nama sama.
 */
export function TeacherForm({
  mode,
  subjects,
  initial,
  action,
}: {
  mode: "create" | "edit";
  subjects: Array<{ id: string; name: string; code: string }>;
  initial?: {
    id?: string;
    nip?: string;
    fullName?: string;
    gender?: string;
    phone?: string;
    email?: string;
    photoUrl?: string | null;
    isActive?: boolean;
    subjectIds?: string[];
  };
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.photoUrl ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const fe = (name: string) => fieldErrors[name]?.[0];
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    if (mode === "edit" && initial?.id) formData.set("id", initial.id);
    if (removePhoto) formData.set("removePhoto", "1");
    const res = await action(formData);
    if (res.ok) {
      router.push(res.id ? `/dashboard/teachers/${res.id}` : "/dashboard/teachers");
      router.refresh();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setPending(false);
    }
  }

  const selected = new Set(initial?.subjectIds ?? []);

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <FormError message={error} />

      <section className="card space-y-4">
        <h2 className="card-title">Data guru</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NIP (opsional)" htmlFor="nip" error={fe("nip")}>
            <Input
              id="nip"
              name="nip"
              defaultValue={initial?.nip ?? ""}
              className="font-mono tabular-nums"
            />
          </Field>
          <Field label="Nama lengkap" htmlFor="fullName" error={fe("fullName")}>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={initial?.fullName ?? ""}
              required
            />
          </Field>
          <Field label="Jenis kelamin" htmlFor="gender" error={fe("gender")}>
            <Select
              id="gender"
              name="gender"
              defaultValue={initial?.gender ?? ""}
              required
            >
              <option value="">Pilih…</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABEL[g]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="No. WA (opsional)" htmlFor="phone" error={fe("phone")}>
            <Input
              id="phone"
              name="phone"
              defaultValue={initial?.phone ?? ""}
              placeholder="081234567890"
              className="tabular-nums"
            />
          </Field>
          <Field label="Email (opsional)" htmlFor="email" error={fe("email")}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={initial?.email ?? ""}
            />
          </Field>
          <Field label="Status" htmlFor="isActive">
            <label className="flex h-10 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={initial?.isActive ?? true}
                className="h-4 w-4 accent-board"
              />
              Aktif mengajar
            </label>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Foto guru (opsional)" htmlFor="photo" error={fe("photo")}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-chalk bg-paper text-slate">
                  {photoPreview && !removePhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="Foto guru"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="h-8 w-8 text-slate/50"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                  )}
                </div>
                <div className="space-y-1.5 text-xs text-slate">
                  <input
                    id="photo"
                    name="photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="block text-sm text-ink file:mr-3 file:rounded file:border file:border-chalk file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-chalk/40"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhotoPreview(URL.createObjectURL(file));
                        setRemovePhoto(false);
                      }
                    }}
                  />
                  <p>Maksimal 2 MB (PNG, JPEG, WEBP).</p>
                  {photoPreview && !removePhoto && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemovePhoto(true);
                        const input = document.getElementById("photo") as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                      className="text-xs text-marker hover:underline"
                    >
                      Hapus foto
                    </button>
                  )}
                </div>
              </div>
            </Field>
          </div>
        </div>
      </section>

      {subjects.length > 0 ? (
        <section className="card space-y-4">
          <h2 className="card-title">Mata pelajaran yang diampu</h2>
          <p className="text-sm text-slate">
            Pilih mapel. Guru per mapel inilah yang dipakai saat input nilai
            (lihat keputusan produk #2).
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 rounded border border-chalk px-3 py-2 text-sm hover:bg-chalk/30"
              >
                <input
                  type="checkbox"
                  name="subjectIds"
                  value={s.id}
                  defaultChecked={selected.has(s.id)}
                  className="h-4 w-4 accent-board"
                />
                <span className="text-ink">{s.name}</span>
                <span className="ml-auto font-mono text-xs text-slate">
                  {s.code}
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : (
        <section className="card">
          <h2 className="card-title">Mata pelajaran</h2>
          <p className="mt-2 text-sm text-slate">
            Belum ada mapel. Tambahkan mapel di menu Akademik terlebih dulu agar
            bisa menetapkan mapel yang diampu.
          </p>
        </section>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Menyimpan…"
            : mode === "create"
              ? "Simpan guru"
              : "Simpan perubahan"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
