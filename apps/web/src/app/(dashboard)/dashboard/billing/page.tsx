import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  getBilling,
  planFeatures,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  PLAN_FEATURE_LABEL,
} from "@/lib/data/billing";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/data-table";

/**
 * Langganan — paket sekolah ini.
 *
 * DUA SUDUT PANDANG dalam satu halaman, karena pertanyaannya berpasangan:
 *   1. "Paket saya sekarang apa, sampai kapan?" → kartu status.
 *   2. "Apa yang saya dapat / tidak dapat?" → perbandingan paket + pemakaian.
 *
 * Pemakaian siswa ditampilkan sebagai batas, bukan sekadar angka: yang dicari
 * admin sekolah bukan "ada 340 siswa", melainkan "masih muat atau tidak".
 *
 * CATATAN: halaman ini BELUM bisa mengubah paket. Pembelian dan pembayaran
 * langganan adalah alur tersendiri (Fase 10 di roadmap) yang menyentuh
 * penagihan ke yayasan — bukan sesuatu yang pantas diselesaikan dengan satu
 * tombol di sini.
 */

export const metadata = { title: "Langganan" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;

  // Super-admin tidak punya langganan sendiri — mereka melihat daftar sekolah.
  // Halaman ini dibangun untuk admin sekolah yang melihat paketnya.
  if (!session.user.schoolId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Langganan"
          context="Akun pengelola sistem tidak terikat pada satu sekolah"
        />
        <div className="rounded-lg border border-chalk bg-white p-6">
          <p className="text-sm text-slate">
            Langganan diatur per sekolah. Buka{" "}
            <a href="/dashboard/schools" className="text-board underline">
              Kelola Sekolah
            </a>{" "}
            untuk melihat paket tiap sekolah.
          </p>
        </div>
      </div>
    );
  }

  if (!can(role, "billing", "read", session.user.permissions)) {
    return (
      <p className="text-slate">
        Halaman ini hanya untuk pengelola sekolah.
      </p>
    );
  }

  const schoolId = session.user.schoolId;
  const data = await getBilling(schoolId);

  // Jumlah pengguna aktif — dipakai sebagai konteks tambahan pada pemakaian.
  const activeUsers = await prisma.user.count({
    where: { schoolId, deletedAt: null, isActive: true },
  });

  const { subscription, plan, usage, school } = data;

  const studentLimit = plan?.maxStudents ?? 0;
  const studentPercent =
    studentLimit > 0 ? Math.min(100, Math.round((usage.students / studentLimit) * 100)) : 0;
  const nearLimit = studentLimit > 0 && studentPercent >= 80;

  // Sisa hari dihitung terhadap akhir hari, supaya "berakhir hari ini"
  // terbaca 0 hari — bukan 1 karena selisih jam.
  const daysLeft = subscription
    ? Math.ceil(
        (new Date(subscription.expiresAt).setHours(23, 59, 59, 999) - Date.now()) /
          86_400_000,
      )
    : null;

  const expiringSoon = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0;
  const expired = daysLeft !== null && daysLeft < 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Langganan"
        context={`${school?.name ?? "Sekolah"} · ${plan ? `paket ${plan.name}` : "belum berlangganan"}`}
      />

      {/* ---- Kartu status utama ---- */}
      <section className="rounded-lg border border-chalk bg-white p-6">
        {subscription && plan ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-light">
                  Paket saat ini
                </p>
                <p className="mt-1 font-display text-3xl text-ink">{plan.name}</p>
                <p className="mt-1 text-sm text-slate">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    minimumFractionDigits: 0,
                  }).format(plan.pricePerMonth)}
                  <span className="text-slate-light"> / bulan</span>
                </p>
              </div>

              <StatusBadge status={subscription.status} />
            </div>

            <dl className="mt-6 grid gap-4 border-t border-chalk pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate">Berlaku sejak</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {formatDate(subscription.startedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate">Berakhir</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {formatDate(subscription.expiresAt)}
                  {daysLeft !== null ? (
                    <span className="ml-2 text-xs text-slate-light">
                      {expired
                        ? `lewat ${Math.abs(daysLeft)} hari`
                        : daysLeft === 0
                          ? "hari ini"
                          : `${daysLeft} hari lagi`}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate">Perpanjangan otomatis</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {subscription.autoRenew ? "Ya" : "Tidak"}
                </dd>
              </div>
            </dl>

            {/* Peringatan hanya saat memang perlu tindakan. */}
            {expired ? (
              <p className="mt-4 border-l-4 border-marker bg-marker/5 px-3 py-2 text-sm text-ink">
                Langganan sudah berakhir. Hubungi penyedia layanan untuk
                memperpanjang agar web sekolah dan notifikasi tetap aktif.
              </p>
            ) : expiringSoon ? (
              <p className="mt-4 border-l-4 border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Langganan berakhir dalam {daysLeft} hari. Sebaiknya diurus
                sekarang agar tidak terputus di tengah tahun ajaran.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="font-display text-xl text-ink">Belum berlangganan</p>
            <p className="mt-2 max-w-prose text-sm text-slate">
              Sekolah ini belum punya paket aktif. Hubungi penyedia layanan
              untuk mengaktifkan, atau lihat pilihan paket di bawah.
            </p>
          </>
        )}
      </section>

      {/* ---- Pemakaian ---- */}
      {plan ? (
        <section className="rounded-lg border border-chalk bg-white p-6">
          <h2 className="font-display text-lg text-ink">Pemakaian</h2>
          <p className="mt-0.5 text-sm text-slate">
            Dibandingkan batas paket {plan.name}.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-slate">Siswa aktif</span>
                <span className="tabular-nums text-sm text-ink">
                  {usage.students.toLocaleString("id-ID")}
                  <span className="text-slate-light">
                    {" / "}
                    {studentLimit.toLocaleString("id-ID")}
                  </span>
                </span>
              </div>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-chalk"
                role="progressbar"
                aria-valuenow={studentPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Pemakaian kuota siswa"
              >
                <div
                  className={`h-full rounded-full ${nearLimit ? "bg-marker" : "bg-board"}`}
                  style={{ width: `${studentPercent}%` }}
                />
              </div>
              {nearLimit ? (
                <p className="mt-1.5 text-xs text-marker">
                  Kuota hampir penuh ({studentPercent}%). Pertimbangkan naik paket
                  sebelum tahun ajaran baru.
                </p>
              ) : null}
            </div>

            <dl className="grid gap-4 border-t border-chalk pt-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate">Guru</dt>
                <dd className="tabular-nums mt-0.5 text-sm text-ink">
                  {usage.teachers.toLocaleString("id-ID")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate">Pengguna aktif</dt>
                <dd className="tabular-nums mt-0.5 text-sm text-ink">
                  {activeUsers.toLocaleString("id-ID")}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}

      {/* ---- Fitur paket ---- */}
      {plan ? (
        <section className="rounded-lg border border-chalk bg-white p-6">
          <h2 className="font-display text-lg text-ink">Yang termasuk</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {planFeatures(plan.features).map((f) => (
              <li key={f.key} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden
                  className={`mt-[3px] shrink-0 text-xs ${
                    f.enabled ? "text-board" : "text-slate-light"
                  }`}
                >
                  {f.enabled ? "✓" : "—"}
                </span>
                <span className={f.enabled ? "text-ink" : "text-slate-light"}>
                  {PLAN_FEATURE_LABEL[f.key] ?? f.key}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Paket lain ---- */}
      {data.otherPlans.length > 0 ? (
        <section>
          <h2 className="font-display text-lg text-ink">Paket lain</h2>
          <p className="mt-0.5 text-sm text-slate">
            Untuk naik paket, hubungi penyedia layanan.
          </p>

          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.otherPlans.map((p) => (
              <li key={p.id} className="rounded-lg border border-chalk bg-white p-5">
                <p className="font-display text-xl text-ink">{p.name}</p>
                <p className="mt-1 text-sm text-slate">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    minimumFractionDigits: 0,
                  }).format(p.pricePerMonth)}
                  <span className="text-slate-light"> / bulan</span>
                </p>
                <p className="mt-3 text-xs text-slate">
                  Hingga {p.maxStudents.toLocaleString("id-ID")} siswa
                </p>
                <ul className="mt-3 space-y-1.5 border-t border-chalk pt-3">
                  {planFeatures(p.features)
                    .filter((f) => f.enabled)
                    .map((f) => (
                      <li key={f.key} className="flex items-start gap-2 text-xs">
                        <span aria-hidden className="mt-[3px] shrink-0 text-board">
                          ✓
                        </span>
                        <span className="text-slate">
                          {PLAN_FEATURE_LABEL[f.key] ?? f.key}
                        </span>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Penanda status langganan — titik + label, sesuai pola tabel lain. */
function StatusBadge({ status }: { status: string }) {
  const tone = SUBSCRIPTION_STATUS_TONE[status] ?? "muted";
  const dot =
    tone === "ok" ? "bg-board" : tone === "warn" ? "bg-marker" : "bg-slate-light";
  const text =
    tone === "ok" ? "text-board" : tone === "warn" ? "text-marker" : "text-slate";

  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${text}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {SUBSCRIPTION_STATUS_LABEL[status] ?? status}
    </span>
  );
}
