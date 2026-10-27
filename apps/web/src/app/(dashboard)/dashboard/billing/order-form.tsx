"use client";

import { useActionState } from "react";
import { orderPlan } from "./actions";
import type { ActionResult } from "@/lib/action-result";

/**
 * Tombol "Perpanjang / Upgrade".
 *
 * Memakai `useActionState` supaya pesan hasil (termasuk PESAN SUKSES MODE
 * MANUAL) muncul di tempat, bukan sebagai toast yang lewat. Mode manual BUKAN
 * galat: sekolah tetap bisa mengajukan walau gateway belum aktif.
 */
export function OrderPlanForm({
  plans,
  defaultPlanId,
}: {
  plans: { id: string; name: string; pricePerMonth: number }[];
  defaultPlanId?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => orderPlan(fd),
    null,
  );

  const rupiah = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  return (
    <form action={action} className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate">Paket</span>
          <select
            name="planId"
            defaultValue={defaultPlanId ?? plans[0]?.id}
            required
            className="mt-1 w-full rounded border border-chalk bg-white px-3 py-2 text-ink"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {rupiah(p.pricePerMonth)}/bulan
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-slate">Lama (bulan)</span>
          <input
            type="number"
            name="months"
            min={1}
            max={36}
            defaultValue={12}
            required
            className="mt-1 w-full rounded border border-chalk bg-white px-3 py-2 text-ink"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending || plans.length === 0}
        className="rounded bg-board px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Mengirim…" : "Perpanjang / Upgrade"}
      </button>

      {state ? (
        <p
          role="status"
          className={`text-sm ${state.ok ? "text-board" : "text-marker"}`}
        >
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
    </form>
  );
}
