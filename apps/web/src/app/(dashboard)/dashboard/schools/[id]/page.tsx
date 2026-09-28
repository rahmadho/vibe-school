import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getSchool, listPlans, listSchoolUsers } from "@/lib/data/schools";
import { SCHOOL_LEVEL_LABEL } from "@/lib/validations/school";
import { USER_ROLE_LABEL } from "@/lib/validations/user";
import { formatDate, formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui";
import { PageHeader } from "@/components/data-table";
import { SUBSCRIPTION_STATUS_LABEL } from "../labels";
import { assignSubscription, toggleSchoolActive } from "../actions";
import {
  SubscriptionForm,
  ToggleActiveButton,
} from "./school-detail-client";
import { ImpersonateButton } from "./impersonate-button";
import { startImpersonation, canImpersonate } from "./impersonate-actions";

export const metadata = { title: "Detail sekolah" };

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "schools", "manage", session.user.permissions)) {
    return <p className="text-slate">Halaman ini khusus untuk super-admin.</p>;
  }

  const { id } = await params;
  const [school, plans, users, mayImpersonate] = await Promise.all([
    getSchool(id),
    listPlans(),
    listSchoolUsers(id),
    canImpersonate(),
  ]);
  if (!school) notFound();

  const sub = school.subscription;

  return (
    <div className="space-y-6">
      <PageHeader
        title={school.name}
        context={`${school.slug} · ${SCHOOL_LEVEL_LABEL[school.level]}${school.npsn ? ` · NPSN ${school.npsn}` : ""}`}
        actions={
          <>
            <Link href="/dashboard/schools">
              <Button variant="ghost">Kembali</Button>
            </Link>
            <Link href={`/dashboard/schools/${school.id}/edit`}>
              <Button>Ubah</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Identitas */}
        <section className="card lg:col-span-2">
          <h2 className="card-title">Identitas</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Row label="Nama" value={school.name} />
            <Row label="Slug" value={school.slug} mono />
            <Row label="Jenjang" value={SCHOOL_LEVEL_LABEL[school.level]} />
            <Row label="NPSN" value={school.npsn ?? "—"} mono />
            <Row label="Zona waktu" value={school.timezone} />
            <Row label="Status" value={school.isActive ? "Aktif" : "Nonaktif"} />
            <Row label="Telepon" value={school.phone ?? "—"} mono />
            <Row label="Email" value={school.email ?? "—"} />
            <div className="sm:col-span-2">
              <Row label="Alamat" value={school.address ?? "—"} />
            </div>
          </dl>
        </section>

        {/* Statistik */}
        <section className="card">
          <h2 className="card-title">Isi data</h2>
          <dl className="mt-4 space-y-4">
            <Row label="Siswa" value={school._count.students.toLocaleString("id-ID")} mono />
            <Row label="Guru" value={school._count.teachers.toLocaleString("id-ID")} mono />
            <Row label="Kelas" value={school._count.classes.toLocaleString("id-ID")} mono />
            <Row label="Pengguna" value={school._count.users.toLocaleString("id-ID")} mono />
          </dl>
        </section>

        {/* White-label */}
        <section className="card lg:col-span-3">
          <h2 className="card-title">White-label</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate">Warna tema</dt>
              <dd className="mt-0.5 flex items-center gap-2 text-sm text-ink">
                {school.themeColor ? (
                  <>
                    <span
                      aria-hidden
                      className="h-4 w-4 rounded border border-chalk"
                      style={{ backgroundColor: school.themeColor }}
                    />
                    <span className="font-mono">{school.themeColor}</span>
                  </>
                ) : (
                  "Belum diatur"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate">Domain kustom</dt>
              <dd className="mt-0.5 font-mono text-sm text-ink">
                {school.customDomain ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate">Nama pengirim WA</dt>
              <dd className="mt-0.5 text-sm text-ink">
                {school.waSenderName ?? "—"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Langganan */}
        <section className="card lg:col-span-3">
          <h2 className="card-title">Langganan</h2>
          {sub ? (
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-4">
              <Row label="Paket" value={sub.plan.name} />
              <Row
                label="Harga"
                value={`${formatRupiah(sub.plan.pricePerMonth)}/bln`}
              />
              <Row
                label="Status"
                value={SUBSCRIPTION_STATUS_LABEL[sub.status] ?? sub.status}
              />
              <Row label="Berlaku sampai" value={formatDate(sub.expiresAt)} />
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate">
              Sekolah ini belum punya langganan aktif.
            </p>
          )}
          <div className="mt-5 border-t border-chalk pt-4">
            <SubscriptionForm
              schoolId={school.id}
              plans={plans}
              currentPlanId={sub?.planId}
              action={assignSubscription}
            />
          </div>
        </section>

        {/* Bantuan: masuk sebagai pengguna sekolah (impersonasi beraudit) */}
        {mayImpersonate ? (
          <section className="card lg:col-span-3">
            <h2 className="card-title">Bantuan &amp; penelusuran</h2>
            <p className="mt-1 max-w-prose text-sm text-slate">
              Masuk sebagai pengguna sekolah untuk menelusuri masalah yang mereka
              laporkan, tanpa perlu meminta kata sandi mereka. Semua tindakan
              selama sesi bantuan tercatat di Log Aktivitas, dan sebuah spanduk
              akan selalu mengingatkan bahwa Anda sedang memerankan akun lain.
            </p>
            {users.length === 0 ? (
              <p className="mt-3 text-sm text-slate">
                Sekolah ini belum punya pengguna aktif.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-chalk">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{u.name}</p>
                      <p className="text-xs text-slate">
                        {USER_ROLE_LABEL[u.role as keyof typeof USER_ROLE_LABEL]} ·{" "}
                        <span className="font-mono">{u.email}</span>
                      </p>
                    </div>
                    {u.role === "SUPER_ADMIN" ? null : (
                      <ImpersonateButton
                        targetUserId={u.id}
                        targetName={u.name}
                        action={startImpersonation}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {/* Status */}
        <section className="card lg:col-span-3">
          <h2 className="card-title">Status sekolah</h2>
          <p className="mt-1 max-w-prose text-sm text-slate">
            Menonaktifkan sekolah akan menghalangi penggunanya masuk, tanpa
            menghapus data apa pun.
          </p>
          <div className="mt-3">
            <ToggleActiveButton
              id={school.id}
              isActive={school.isActive}
              action={toggleSchoolActive}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate">{label}</dt>
      <dd className={`mt-0.5 text-sm text-ink ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
