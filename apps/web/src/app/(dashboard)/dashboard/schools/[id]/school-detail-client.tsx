"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Select, FormError, FormSuccess } from "@/components/form-fields";
import { formatRupiah } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

type Plan = { id: string; name: string; pricePerMonth: number; maxStudents: number };

/** Form penetapan paket langganan (super-admin). */
export function SubscriptionForm({
  schoolId,
  plans,
  currentPlanId,
  action,
}: {
  schoolId: string;
  plans: Plan[];
  currentPlanId?: string;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await action(formData);
      if (res.ok) {
        setSuccess(res.message ?? "Tersimpan.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (plans.length === 0) {
    return (
      <p className="text-sm text-slate">
        Belum ada paket langganan. Tambahkan paket di database (seed) terlebih
        dulu.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <FormError message={error} />
      <FormSuccess message={success} />
      <input type="hidden" name="schoolId" value={schoolId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="planId" className="mb-1 block text-xs font-medium text-slate">
            Paket
          </label>
          <Select id="planId" name="planId" defaultValue={currentPlanId ?? plans[0]?.id}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatRupiah(p.pricePerMonth)}/bln (maks {p.maxStudents}{" "}
                siswa)
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="months" className="mb-1 block text-xs font-medium text-slate">
            Masa aktif (bulan)
          </label>
          <input
            id="months"
            name="months"
            type="number"
            min={1}
            max={60}
            defaultValue={12}
            className="h-10 w-full rounded border border-chalk px-3 text-sm tabular-nums focus:border-board focus:outline-none"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Tetapkan paket"}
      </Button>
    </form>
  );
}

/** Tombol aktif/nonaktif sekolah. */
export function ToggleActiveButton({
  id,
  isActive,
  action,
}: {
  id: string;
  isActive: boolean;
  action: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await action(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <FormError message={error} />
      <Button variant={isActive ? "danger" : "secondary"} onClick={run} disabled={pending}>
        {pending ? "Memproses…" : isActive ? "Nonaktifkan sekolah" : "Aktifkan sekolah"}
      </Button>
    </div>
  );
}
