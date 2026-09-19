"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { FormError, FormSuccess } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

/** Form reset password (ditampilkan dengan konfirmasi). */
export function ResetPasswordForm({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const fe = (n: string) => fieldErrors[n]?.[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    const form = e.currentTarget;
    const res = await action(new FormData(form));
    if (res.ok) {
      form.reset();
      setSuccess(res.message ?? "Password diperbarui.");
      setOpen(false);
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    }
    setPending(false);
  }

  return (
    <div className="space-y-3">
      <FormSuccess message={success} />
      <FormError message={error} />
      {!open ? (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Setel ulang password
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <input type="hidden" name="id" value={id} />
          <Field label="Password baru" htmlFor="password" error={fe("password")}>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan password"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
