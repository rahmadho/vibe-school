"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError } from "@/components/form-fields";
import {
  USER_ROLES,
  USER_ROLE_LABEL,
  SCHOOL_MANAGEABLE_ROLES,
} from "@/lib/validations/user";
import type { ActionResult } from "@/lib/action-result";
import type { UserRole } from "@prisma/client";

/**
 * Form pengguna — create & edit.
 * Opsi role dibatasi untuk admin sekolah (tak boleh SUPER_ADMIN).
 */
export function UserForm({
  mode,
  actorRole,
  initial,
  action,
}: {
  mode: "create" | "edit";
  actorRole: UserRole;
  initial?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
    phone?: string;
    isActive?: boolean;
  };
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const fe = (n: string) => fieldErrors[n]?.[0];

  const roleOptions =
    actorRole === "SUPER_ADMIN"
      ? [...USER_ROLES]
      : [...SCHOOL_MANAGEABLE_ROLES];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const formData = new FormData(e.currentTarget);
    if (mode === "edit" && initial?.id) formData.set("id", initial.id);

    const res = await action(formData);
    if (res.ok) {
      router.push(res.id ? `/dashboard/users/${res.id}` : "/dashboard/users");
      router.refresh();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormError message={error} />

      <section className="card space-y-4">
        <h2 className="card-title">Data akun</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nama" htmlFor="name" error={fe("name")}>
              <Input id="name" name="name" defaultValue={initial?.name ?? ""} required />
            </Field>
          </div>

          {mode === "create" ? (
            <>
              <Field label="Email (untuk login)" htmlFor="email" error={fe("email")}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={initial?.email ?? ""}
                  required
                  autoComplete="off"
                />
              </Field>
              <Field label="Password awal" htmlFor="password" error={fe("password")}>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </Field>
            </>
          ) : (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate">Email</dt>
              <dd className="mt-0.5 font-mono text-sm text-ink">
                {initial?.email}
              </dd>
              <p className="mt-1 text-xs text-slate">
                Email tidak dapat diubah. Untuk mengganti, buat akun baru.
              </p>
            </div>
          )}

          <Field label="Role" htmlFor="role" error={fe("role")}>
            <Select id="role" name="role" defaultValue={initial?.role ?? ""} required>
              <option value="">Pilih role…</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {USER_ROLE_LABEL[r]}
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

          <Field label="Status" htmlFor="isActive">
            <label className="flex h-10 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={initial?.isActive ?? true}
                className="h-4 w-4 accent-board"
              />
              Akun aktif
            </label>
          </Field>
        </div>
        {mode === "create" ? (
          <p className="text-xs text-slate">
            Sampaikan email dan password kepada pemilik akun. Minta mereka
            mengganti password setelah masuk pertama kali.
          </p>
        ) : null}
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : mode === "create" ? "Buat akun" : "Simpan perubahan"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Batal
        </Button>
      </div>
    </form>
  );
}
