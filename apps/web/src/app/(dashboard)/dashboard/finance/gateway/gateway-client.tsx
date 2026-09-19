"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError, FormSuccess } from "@/components/form-fields";
import {
  GATEWAY_LABEL,
  GATEWAY_CHANNELS,
  type GatewayProviderValue,
} from "@/lib/validations/finance";
import type { ActionResult } from "@/lib/action-result";
import { saveGatewayConfig, deleteGatewayCredentials, testGatewayConnection } from "../gateway-actions";

type Current = {
  environment: string;
  isActive: boolean;
  channels: string[];
  orderPrefix: string | null;
  hasServerKey: boolean;
  serverKeyLast4: string | null;
  hasClientKey: boolean;
} | null;

export function GatewayForm({
  provider,
  current,
  encryptionReady,
}: {
  provider: GatewayProviderValue;
  current: Current;
  encryptionReady: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const fe = (n: string) => fieldErrors[n]?.[0];

  const channels = GATEWAY_CHANNELS[provider];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);
    fd.set("provider", provider);

    const res = await saveGatewayConfig(fd);
    if (res.ok) {
      setSuccess(res.message ?? "Pengaturan disimpan.");
      router.refresh();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    }
    setPending(false);
  }

  async function onTest() {
    setPending(true);
    setError(null);
    setSuccess(null);
    const res = await testGatewayConnection();
    if (res.ok) setSuccess(res.message ?? "Kredensial terbaca.");
    else setError(res.error);
    setPending(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-chalk bg-white p-5"
      noValidate
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="card-title">{GATEWAY_LABEL[provider]}</h2>
        {current?.isActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-board/30 bg-board/5 px-2.5 py-1 text-xs text-board">
            <span className="inline-block h-2 w-2 rounded-full bg-board" aria-hidden />
            Aktif
          </span>
        ) : (
          <span className="text-xs text-slate">Tidak aktif</span>
        )}
      </div>

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Lingkungan" htmlFor={`env-${provider}`} error={fe("environment")}>
          <Select
            id={`env-${provider}`}
            name="environment"
            defaultValue={current?.environment ?? "sandbox"}
          >
            <option value="sandbox">Sandbox (uji coba)</option>
            <option value="production">Production (sungguhan)</option>
          </Select>
        </Field>
        <Field
          label="Awalan order ID"
          htmlFor={`prefix-${provider}`}
          error={fe("orderPrefix")}
        >
          <Input
            id={`prefix-${provider}`}
            name="orderPrefix"
            defaultValue={current?.orderPrefix ?? ""}
            placeholder="SMPN1"
            className="font-mono"
          />
        </Field>

        <Field
          label="Server key"
          htmlFor={`sk-${provider}`}
          error={fe("serverKey")}
        >
          <Input
            id={`sk-${provider}`}
            name="serverKey"
            type="password"
            autoComplete="off"
            placeholder={current?.hasServerKey ? "••••••••" : "Masukkan server key"}
            className="font-mono"
          />
          <p className="text-xs text-slate">
            {current?.hasServerKey
              ? `Tersimpan: ••••${current.serverKeyLast4 ?? "????"} — kosongkan bila tidak ingin mengubah.`
              : "Wajib untuk membuat transaksi."}
          </p>
        </Field>
        <Field
          label="Client key (opsional)"
          htmlFor={`ck-${provider}`}
          error={fe("clientKey")}
        >
          <Input
            id={`ck-${provider}`}
            name="clientKey"
            type="password"
            autoComplete="off"
            placeholder={current?.hasClientKey ? "••••••••" : "Client key (bila ada)"}
            className="font-mono"
          />
          {current?.hasClientKey ? (
            <p className="text-xs text-slate">Sudah tersimpan.</p>
          ) : null}
        </Field>
      </div>

      {channels.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-slate">
            Kanal pembayaran yang diaktifkan
          </legend>
          <div className="flex flex-wrap gap-3">
            {channels.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="channels"
                  value={c.id}
                  defaultChecked={current?.channels.includes(c.id)}
                  className="h-4 w-4 accent-[#1f4e46]"
                />
                {c.label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate">
            Kanal yang aktif langsung terlihat di aplikasi orang tua.
          </p>
        </fieldset>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={current?.isActive}
          className="h-4 w-4 accent-[#1f4e46]"
        />
        Aktifkan gateway ini (menggantikan gateway lain yang aktif)
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !encryptionReady}>
          {pending ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onTest}
          disabled={pending || !current?.hasServerKey}
        >
          Uji kredensial
        </Button>
        {!encryptionReady ? (
          <span className="self-center text-xs text-marker">
            Kunci enkripsi server belum diatur.
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function ClearCredentialsButton({ provider }: { provider: GatewayProviderValue }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setPending(true);
    setError(null);
    void deleteGatewayCredentials(provider).then((res: ActionResult) => {
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(res.error);
      }
      setPending(false);
    });
  }

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Hapus kredensial {GATEWAY_LABEL[provider]}
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {error ? <span className="text-xs text-marker">{error}</span> : null}
      <span className="text-sm text-slate">Hapus dan nonaktifkan?</span>
      <Button variant="danger" onClick={run} disabled={pending}>
        Ya
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
        Batal
      </Button>
    </span>
  );
}
