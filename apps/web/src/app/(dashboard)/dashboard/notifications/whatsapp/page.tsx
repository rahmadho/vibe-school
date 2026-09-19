import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getWaSession } from "@/lib/data/notifications";
import { gatewayConfigured } from "@/lib/gateway-web";
import { WaConnectPanel } from "./wa-client";

export const dynamic = "force-dynamic";

export default async function WhatsappPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "notifications", "manage")) redirect("/dashboard");

  const schoolId = session.user.schoolId as string;
  const saved = await getWaSession(schoolId);
  const configured = gatewayConfigured();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/notifications"
          className="text-sm text-slate underline-offset-2 hover:underline"
        >
          ← Notifikasi
        </Link>
        <h1 className="mt-2 font-serif text-2xl text-ink">Koneksi WhatsApp</h1>
        <p className="mt-1 text-sm text-slate">
          Sambungkan nomor WhatsApp sekolah untuk mengirim notifikasi ke orang tua.
        </p>
      </div>

      {!configured && (
        <div className="rounded-lg border border-marker/40 bg-marker/5 p-4 text-sm text-ink">
          <p className="font-medium">Token gateway belum diatur</p>
          <p className="mt-1 text-slate">
            Atur <code className="rounded bg-board px-1">WA_GATEWAY_TOKEN</code> pada{" "}
            <code className="rounded bg-board px-1">apps/web/.env</code> dengan nilai
            yang sama seperti di{" "}
            <code className="rounded bg-board px-1">apps/wa-gateway/.env</code>, lalu
            jalankan <code className="rounded bg-board px-1">docker compose up -d</code>.
          </p>
        </div>
      )}

      <WaConnectPanel
        initial={
          saved
            ? {
                status: saved.status,
                phoneNumber: saved.phoneNumber,
                qrDataUrl: null,
                lastError: saved.lastError,
                lastSeenAt: saved.lastSeenAt?.toISOString() ?? null,
              }
            : null
        }
      />
    </div>
  );
}
