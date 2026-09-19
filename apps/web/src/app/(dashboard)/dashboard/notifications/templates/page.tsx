import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTemplates, countMissingSeedTemplates } from "@/lib/data/notifications";
import {
  TEMPLATE_CATEGORY_LABEL,
  type TemplateCategoryValue,
} from "@/lib/validations/notification";
import {
  TemplateForm,
  TemplateRow,
  ImportSeedButton,
} from "./template-client";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "notifications", "manage")) redirect("/dashboard");

  const schoolId = session.user.schoolId as string;
  const [templates, missing] = await Promise.all([
    listTemplates(schoolId),
    countMissingSeedTemplates(schoolId),
  ]);

  // Kelompokkan per kategori agar mudah dicari.
  const grouped = new Map<string, typeof templates>();
  for (const t of templates) {
    const arr = grouped.get(t.category) ?? [];
    arr.push(t);
    grouped.set(t.category, arr);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/notifications"
            className="text-sm text-slate underline-offset-2 hover:underline"
          >
            ← Notifikasi
          </Link>
          <h1 className="mt-2 font-serif text-2xl text-ink">Template pesan</h1>
          <p className="mt-1 text-sm text-slate">
            Ubah bunyi pesan WhatsApp tanpa menyentuh kode program.{" "}
            {templates.length} template tersedia.
          </p>
        </div>
        {missing > 0 && <ImportSeedButton missing={missing} />}
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-chalk bg-paper p-8 text-center">
          <p className="text-sm text-ink">Belum ada template pesan.</p>
          <p className="mt-1 text-sm text-slate">
            Impor template bawaan untuk memulai — sudah tersedia pesan absensi,
            tagihan, nilai, dan SPMB yang siap pakai.
          </p>
          <div className="mt-4 flex justify-center">
            <ImportSeedButton missing={missing} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <section
              key={category}
              className="overflow-hidden rounded-lg border border-chalk bg-paper"
            >
              <div className="border-b border-chalk bg-board/50 px-4 py-2">
                <h2 className="text-sm font-medium text-ink">
                  {TEMPLATE_CATEGORY_LABEL[category as TemplateCategoryValue] ??
                    category}
                  <span className="ml-2 font-mono text-xs text-slate">
                    {items.length}
                  </span>
                </h2>
              </div>
              {items.map((t) => (
                <TemplateRow key={t.id} t={t} />
              ))}
            </section>
          ))}
        </div>
      )}

      <section className="rounded-lg border border-chalk bg-paper p-4">
        <h2 className="font-medium text-ink">Buat template baru</h2>
        <p className="mt-1 text-sm text-slate">
          Gunakan variabel seperti{" "}
          <code className="rounded bg-board px-1 text-xs">
            {"{{nama_siswa}}"}
          </code>{" "}
          yang akan diisi otomatis saat pesan dikirim.
        </p>
        <div className="mt-4">
          <TemplateForm />
        </div>
      </section>

      <section className="rounded-lg border border-chalk bg-board/30 p-4">
        <h2 className="text-sm font-medium text-ink">Variabel yang tersedia</h2>
        <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["nama_sekolah", "Nama sekolah"],
            ["nama_siswa", "Nama siswa"],
            ["nama_wali", "Nama orang tua/wali"],
            ["kelas", "Kelas siswa"],
            ["tanggal", "Tanggal kejadian"],
            ["mata_pelajaran", "Nama mata pelajaran"],
            ["nilai", "Nilai siswa"],
            ["kkm", "Batas ketuntasan (KKM)"],
            ["judul_tagihan", "Nama tagihan"],
            ["jumlah", "Nominal rupiah"],
            ["jatuh_tempo", "Tanggal jatuh tempo"],
            ["tautan_bayar", "Tautan pembayaran online"],
            ["hadir", "Jumlah hari hadir"],
            ["sisa", "Sisa tagihan"],
          ].map(([k, label]) => (
            <div key={k} className="flex items-baseline gap-2">
              <code className="rounded bg-paper px-1.5 py-0.5 text-slate">
                {`{{${k}}}`}
              </code>
              <span className="text-slate/70">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
