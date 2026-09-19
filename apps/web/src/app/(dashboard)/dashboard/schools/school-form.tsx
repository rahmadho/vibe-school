"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, Textarea, FormError } from "@/components/form-fields";
import {
  SCHOOL_LEVELS,
  SCHOOL_LEVEL_LABEL,
} from "@/lib/validations/school";
import type { ActionResult } from "@/lib/action-result";

/**
 * Form sekolah — dipakai super-admin untuk membuat & mengubah sekolah.
 * Termasuk white-label (warna tema) dan konfigurasi WhatsApp.
 */
export function SchoolForm({
  mode,
  initial,
  action,
}: {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    name?: string;
    slug?: string;
    npsn?: string;
    level?: string;
    address?: string;
    phone?: string;
    email?: string;
    timezone?: string;
    themeColor?: string;
    customDomain?: string;
    waSenderName?: string;
    isActive?: boolean;
  };
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const [themeColor, setThemeColor] = useState(initial?.themeColor ?? "#1E6B52");
  const fe = (n: string) => fieldErrors[n]?.[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const formData = new FormData(e.currentTarget);
    if (mode === "edit" && initial?.id) formData.set("id", initial.id);

    const res = await action(formData);
    if (res.ok) {
      router.push(res.id ? `/dashboard/schools/${res.id}` : "/dashboard/schools");
      router.refresh();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <FormError message={error} />

      {/* Identitas sekolah */}
      <section className="card space-y-4">
        <h2 className="card-title">Identitas sekolah</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nama sekolah" htmlFor="name" error={fe("name")}>
              <Input
                id="name"
                name="name"
                defaultValue={initial?.name ?? ""}
                placeholder="SMP Negeri 1 Bandung"
                required
              />
            </Field>
          </div>
          <Field
            label="Slug (untuk alamat URL)"
            htmlFor="slug"
            error={fe("slug")}
          >
            <Input
              id="slug"
              name="slug"
              defaultValue={initial?.slug ?? ""}
              placeholder="smpn1-bandung"
              required
              disabled={mode === "edit"}
              className="font-mono lowercase"
            />
            {mode === "edit" ? (
              <p className="mt-1 text-xs text-slate">
                Slug tidak dapat diubah setelah dibuat.
              </p>
            ) : null}
          </Field>
          <Field label="NPSN (opsional)" htmlFor="npsn" error={fe("npsn")}>
            <Input
              id="npsn"
              name="npsn"
              defaultValue={initial?.npsn ?? ""}
              className="font-mono tabular-nums"
            />
          </Field>
          <Field label="Jenjang" htmlFor="level" error={fe("level")}>
            <Select id="level" name="level" defaultValue={initial?.level ?? ""} required>
              <option value="">Pilih jenjang…</option>
              {SCHOOL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {SCHOOL_LEVEL_LABEL[l]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Zona waktu" htmlFor="timezone">
            <Input
              id="timezone"
              name="timezone"
              defaultValue={initial?.timezone ?? "Asia/Jakarta"}
              placeholder="Asia/Jakarta"
            />
          </Field>
          <Field label="Telepon (opsional)" htmlFor="phone" error={fe("phone")}>
            <Input
              id="phone"
              name="phone"
              defaultValue={initial?.phone ?? ""}
              placeholder="081234567890"
              className="tabular-nums"
            />
          </Field>
          <Field label="Email sekolah (opsional)" htmlFor="email" error={fe("email")}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={initial?.email ?? ""}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alamat (opsional)" htmlFor="address">
              <Textarea
                id="address"
                name="address"
                defaultValue={initial?.address ?? ""}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* White-label */}
      <section className="card space-y-4">
        <h2 className="card-title">Tampilan & domain (white-label)</h2>
        <p className="text-sm text-slate">
          Warna tema dipakai pada halaman publik sekolah dan bagian tertentu
          aplikasi. Domain kustom memerlukan pengaturan DNS di sisi Anda.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Warna tema" htmlFor="themeColor" error={fe("themeColor")}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-chalk"
                aria-label="Pilih warna"
              />
              <Input
                id="themeColor"
                name="themeColor"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                placeholder="#1E6B52"
                className="font-mono uppercase"
              />
            </div>
          </Field>
          <Field label="Domain kustom (opsional)" htmlFor="customDomain" error={fe("customDomain")}>
            <Input
              id="customDomain"
              name="customDomain"
              defaultValue={initial?.customDomain ?? ""}
              placeholder="sekolah.sch.id"
              className="font-mono lowercase"
            />
          </Field>
        </div>
      </section>

      {/* WhatsApp */}
      <section className="card space-y-4">
        <h2 className="card-title">Notifikasi WhatsApp</h2>
        <Field label="Nama pengirim WA (opsional)" htmlFor="waSenderName" error={fe("waSenderName")}>
          <Input
            id="waSenderName"
            name="waSenderName"
            defaultValue={initial?.waSenderName ?? ""}
            placeholder="Admin SMPN 1"
          />
        </Field>
        <p className="text-xs text-slate">
          Nama ini dipakai pada pesan WhatsApp ke orang tua (mis. tagihan,
          absensi). Koneksi perangkat WA diatur terpisah pada menu Notifikasi.
        </p>
      </section>

      {/* Akun admin pertama (hanya saat create) */}
      {mode === "create" ? (
        <section className="card space-y-4">
          <h2 className="card-title">Admin sekolah (opsional)</h2>
          <p className="text-sm text-slate">
            Buat akun admin pertama agar sekolah langsung bisa digunakan.
            Boleh dikosongkan dan dibuat belakangan.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nama admin" htmlFor="adminName">
              <Input id="adminName" name="adminName" placeholder="Nama lengkap" />
            </Field>
            <Field label="Email admin" htmlFor="adminEmail">
              <Input
                id="adminEmail"
                name="adminEmail"
                type="email"
                placeholder="admin@sekolah.sch.id"
              />
            </Field>
            <Field label="Password admin" htmlFor="adminPassword">
              <Input
                id="adminPassword"
                name="adminPassword"
                type="password"
                minLength={8}
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
              />
            </Field>
          </div>
        </section>
      ) : (
        <section className="card space-y-4">
          <h2 className="card-title">Status sekolah</h2>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={initial?.isActive ?? true}
              className="h-4 w-4 accent-board"
            />
            Sekolah aktif (dapat diakses penggunanya)
          </label>
        </section>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : mode === "create" ? "Buat sekolah" : "Simpan perubahan"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Batal
        </Button>
      </div>
    </form>
  );
}
