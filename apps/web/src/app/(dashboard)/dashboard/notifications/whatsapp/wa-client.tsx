"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { FormError, FormSuccess } from "@/components/form-fields";
import {
  WA_STATUS_LABEL,
  WA_STATUS_TONE,
} from "@/lib/notification-labels";
import {
  connectWhatsapp,
  disconnectWhatsapp,
  logoutWhatsapp,
  fetchQr,
  type QrResult,
} from "../wa-actions";

type State = {
  status: string;
  phoneNumber: string | null;
  qrDataUrl: string | null;
  lastError: string | null;
  lastSeenAt: string | null;
};

export function WaConnectPanel({ initial }: { initial: State | null }) {
  const [state, setState] = useState<State | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const poll = useCallback(async () => {
    const res: QrResult = await fetchQr();
    if (res.ok) {
      setState({
        status: res.status,
        phoneNumber: res.phoneNumber,
        qrDataUrl: res.qrDataUrl,
        lastError: res.lastError,
        lastSeenAt: res.lastSeenAt,
      });
      if (res.status === "Connected") {
        setSuccess("WhatsApp berhasil tersambung. Notifikasi siap dikirim.");
        if (timer.current) clearInterval(timer.current);
        router.refresh();
      }
    } else if (!res.error.includes("belum berjalan")) {
      // Diamkan galat "sesi belum berjalan" — itu normal sebelum klik Sambungkan.
      setError(res.error);
    }
  }, [router]);

  // Polling hanya saat menunggu QR; berhenti begitu tersambung.
  useEffect(() => {
    const waiting = state?.status === "Pairing" || state?.status === "Disconnected";
    if (!waiting) {
      if (timer.current) clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => void poll(), 3_000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [state?.status, poll]);

  async function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await fn();
      if (res.ok) {
        setSuccess(res.message ?? "Selesai.");
        await poll();
      } else {
        setError(res.error ?? "Gagal.");
      }
    } finally {
      setBusy(false);
    }
  }

  const status = state?.status ?? "Disconnected";
  const connected = status === "Connected";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="rounded-lg border border-chalk bg-paper p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-ink">Status koneksi</h2>
            <span className={`text-sm font-medium ${WA_STATUS_TONE[status] ?? "text-slate"}`}>
              {WA_STATUS_LABEL[status] ?? status}
            </span>
          </div>

          {state?.phoneNumber && (
            <p className="mt-2 text-sm text-slate">
              Nomor terhubung:{" "}
              <span className="font-mono tabular-nums text-ink">
                +{state.phoneNumber}
              </span>
            </p>
          )}

          {state?.lastError && !connected && (
            <p className="mt-2 rounded border border-marker/30 bg-marker/5 px-2 py-1 text-xs text-marker">
              {state.lastError}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {!connected && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => run(connectWhatsapp)}
              >
                {busy ? "Menyiapkan…" : "Sambungkan WhatsApp"}
              </Button>
            )}
            {connected && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => run(disconnectWhatsapp)}
              >
                Putuskan sementara
              </Button>
            )}
            {status !== "LoggedOut" && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => run(logoutWhatsapp)}
                title="Menghapus kredensial — perlu pindai QR lagi"
              >
                Keluar & hapus sesi
              </Button>
            )}
          </div>

          <FormError message={error} />
          <FormSuccess message={success} />
        </div>

        <div className="rounded-lg border border-chalk bg-paper p-4">
          <h2 className="font-medium text-ink">Cara menyambungkan</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate">
            <li className="flex gap-2">
              <span className="font-mono text-ink">1.</span>
              Buka WhatsApp di HP sekolah.
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-ink">2.</span>
              Ketuk <em>Pengaturan</em> → <em>Perangkat Tertaut</em> →{" "}
              <em>Tautkan Perangkat</em>.
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-ink">3.</span>
              Pindai QR di samping dengan kamera HP.
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-ink">4.</span>
              Setelah tersambung, halaman ini berubah sendiri menjadi{" "}
              <em>Tersambung</em>.
            </li>
          </ol>
          <p className="mt-3 rounded border border-chalk bg-board/40 px-3 py-2 text-xs text-slate">
            Gunakan nomor khusus sekolah, bukan nomor pribadi — semua pesan akan
            terkirim dari nomor ini.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-chalk bg-paper p-4">
        <h2 className="font-medium text-ink">Kode QR</h2>
        <div className="mt-3 flex min-h-[300px] items-center justify-center rounded border border-dashed border-chalk bg-board/30 p-4">
          {connected ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
                ✓
              </div>
              <p className="mt-3 text-sm text-ink">WhatsApp tersambung</p>
              <p className="mt-1 text-xs text-slate">
                Notifikasi akan dikirim dari nomor ini.
              </p>
            </div>
          ) : state?.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.qrDataUrl}
              alt="Kode QR untuk menautkan WhatsApp"
              className="h-64 w-64 rounded bg-white p-2"
            />
          ) : (
            <p className="text-center text-sm text-slate">
              {status === "Pairing"
                ? "Menunggu kode QR…"
                : "Klik “Sambungkan WhatsApp” untuk menampilkan kode QR."}
            </p>
          )}
        </div>
        {!connected && state?.qrDataUrl && (
          <p className="mt-2 text-center text-xs text-amber-700">
            QR berlaku sekitar 60 detik dan akan diperbarui otomatis.
          </p>
        )}
      </div>
    </div>
  );
}
