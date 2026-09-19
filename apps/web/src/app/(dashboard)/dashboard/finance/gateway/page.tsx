import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listGatewayConfigs } from "@/lib/data/finance";
import { PageHeader } from "@/components/data-table";
import { Button } from "@/components/ui";
import type { GatewayProviderValue } from "@/lib/validations/finance";
import { GatewayForm, ClearCredentialsButton } from "./gateway-client";

export const metadata = { title: "Payment gateway" };

export default async function GatewaySettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  const schoolId = session.user.schoolId;

  if (!can(session.user.role, "finance", "manage")) {
    return <p className="text-slate">Hanya admin dan bendahara yang dapat mengubah pengaturan gateway.</p>;
  }

  const rows = await listGatewayConfigs(schoolId);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  const encryptionReady = Boolean(process.env.PAYMENT_ENCRYPTION_KEY);

  // URL webhook yang harus didaftarkan sekolah di dasbor provider.
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://sekolah-anda.sch.id";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment gateway"
        context="Aktifkan pembayaran online — pembayaran manual tetap tersedia"
        actions={
          <Link href="/dashboard/finance">
            <Button variant="ghost">Kembali</Button>
          </Link>
        }
      />

      {/* Penjelasan dua jalur */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-chalk bg-white p-5">
          <h2 className="card-title">1 · Pembayaran manual</h2>
          <p className="mt-2 text-sm text-slate">
            Bendahara menerima tunai atau transfer bank, lalu mencatatnya di
            detail tagihan. Tidak butuh konfigurasi apa pun — langsung bisa
            dipakai. Buat metode pembayarannya di{" "}
            <Link href="/dashboard/finance/methods" className="text-board underline">
              Metode pembayaran
            </Link>
            .
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-board">
            <span className="inline-block h-2 w-2 rounded-full bg-board" aria-hidden />
            Selalu tersedia
          </p>
        </div>

        <div className="rounded-lg border border-chalk bg-white p-5">
          <h2 className="card-title">2 · Pembayaran online (gateway)</h2>
          <p className="mt-2 text-sm text-slate">
            Orang tua membayar lewat tautan/VA. Status tagihan terbarui otomatis
            melalui webhook. Pilih satu provider: Midtrans atau Xendit.
          </p>
          <p className="mt-3 text-xs text-slate">
            Hanya <strong>satu</strong> gateway yang bisa aktif agar tidak ada dua
            tautan pembayaran untuk tagihan yang sama.
          </p>
        </div>
      </div>

      {!encryptionReady ? (
        <div className="rounded-lg border border-marker/40 bg-marker/5 p-4 text-sm">
          <p className="font-medium text-marker">
            Kunci enkripsi belum diatur di server
          </p>
          <p className="mt-1 text-slate">
            Kredensial gateway disimpan terenkripsi (AES-256-GCM). Atur{" "}
            <code className="rounded bg-white px-1 font-mono text-xs">
              PAYMENT_ENCRYPTION_KEY
            </code>{" "}
            (64 karakter heksadesimal) di berkas <code>.env</code> server sebelum
            menyimpan kunci. Tanpa ini, sistem menolak menyimpan kredensial demi
            keamanan.
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-white p-3 font-mono text-xs text-slate">
{`# buat kunci baru
openssl rand -hex 32`}
          </pre>
        </div>
      ) : null}

      {/* Webhook URL */}
      <div className="rounded-lg border border-chalk bg-white p-5">
        <h2 className="card-title">URL webhook</h2>
        <p className="mt-1 text-sm text-slate">
          Daftarkan URL ini di dasbor provider agar status pembayaran terbarui
          otomatis.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <span className="text-slate">Midtrans:</span>
            <code className="ml-2 break-all rounded bg-paper px-2 py-1 font-mono text-xs">
              {base}/api/gateway/webhook?provider=midtrans
            </code>
          </li>
          <li>
            <span className="text-slate">Xendit:</span>
            <code className="ml-2 break-all rounded bg-paper px-2 py-1 font-mono text-xs">
              {base}/api/gateway/webhook?provider=xendit
            </code>
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate">
          Webhook memverifikasi tanda tangan/token sebelum memproses, dan
          <strong> idempoten</strong> — notifikasi yang dikirim ulang tidak akan
          mencatat pembayaran dua kali.
        </p>
      </div>

      {/* Form per provider */}
      {(["MIDTRANS", "XENDIT"] as const).map((provider) => {
        const cfg = byProvider.get(provider);
        return (
          <GatewayForm
            key={provider}
            provider={provider as GatewayProviderValue}
            current={
              cfg
                ? {
                    environment: cfg.environment,
                    isActive: cfg.isActive,
                    channels: cfg.channels,
                    orderPrefix: cfg.orderPrefix,
                    hasServerKey: Boolean(cfg.serverKeyEnc),
                    serverKeyLast4: cfg.serverKeyLast4,
                    hasClientKey: Boolean(cfg.clientKeyEnc),
                  }
                : null
            }
            encryptionReady={encryptionReady}
          />
        );
      })}

      {rows.some((r) => r.serverKeyEnc) ? (
        <div className="rounded-lg border border-chalk bg-white p-5">
          <h2 className="card-title">Hapus kredensial</h2>
          <p className="mb-3 mt-1 text-sm text-slate">
            Menghapus kredensial akan menonaktifkan gateway tersebut. Riwayat
            transaksi tetap tersimpan.
          </p>
          <div className="flex flex-wrap gap-3">
            {(["MIDTRANS", "XENDIT"] as const)
              .filter((p) => Boolean(byProvider.get(p)?.serverKeyEnc))
              .map((p) => (
                <ClearCredentialsButton key={p} provider={p} />
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
