"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError } from "@/components/form-fields";
import {
  STAFF_POSITIONS,
  STAFF_POSITION_LABEL,
} from "@/lib/validations/personnel";
import type { ActionResult } from "@/lib/action-result";

/** Form staf — create & edit. */
export function StaffForm({
  mode,
  initial,
  action,
}: {
  mode: "create" | "edit";
  initial?: {
    id?: string;
    nip?: string;
    fullName?: string;
    position?: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
  };
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  const fe = (name: string) => fieldErrors[name]?.[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    if (mode === "edit" && initial?.id) formData.set("id", initial.id);

    const res = await action(formData);
    if (res.ok) {
      router.push("/dashboard/staff");
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
        <h2 className="card-title">Data staf</h2>
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
          <Field label="Jabatan" htmlFor="position" error={fe("position")}>
            <Select
              id="position"
              name="position"
              defaultValue={initial?.position ?? ""}
            >
              <option value="">—</option>
              {STAFF_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {STAFF_POSITION_LABEL[p]}
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
              Masih aktif
            </label>
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Menyimpan…"
            : mode === "create"
              ? "Simpan staf"
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
