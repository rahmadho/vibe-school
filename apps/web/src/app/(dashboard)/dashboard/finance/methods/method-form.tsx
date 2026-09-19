"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { FormError } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

export function PaymentMethodForm({
  action,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const fe = (n: string) => fieldErrors[n]?.[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    const form = e.currentTarget;
    const res = await action(new FormData(form));
    if (res.ok) {
      form.reset();
      router.refresh();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama" htmlFor="name" error={fe("name")}>
          <Input id="name" name="name" placeholder="Transfer BCA" required />
        </Field>
        <Field label="Kode" htmlFor="code" error={fe("code")}>
          <Input id="code" name="code" placeholder="BCA" required className="font-mono" />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Tambah metode"}
      </Button>
    </form>
  );
}
