import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveSchoolFromRequest } from "@/lib/site-server";
import { getPublicBatches } from "@/lib/data/site";
import { Section, SectionHeading, SiteButton, BlockEmpty, formatSiteDate } from "@/components/site/site-ui";
import { SpmbForm, type PublicBatch } from "./spmb-form";

/**
 * Halaman pendaftaran SPMB publik.
 *
 * Halaman ini sering jadi pintu masuk pertama orang tua ke web sekolah — dari
 * brosur atau tautan WhatsApp, bukan dari beranda. Karena itu ia harus bisa
 * berdiri sendiri: langsung menjelaskan apa yang didaftarkan, jalurnya apa, dan
 * apa syaratnya — tanpa mengharuskan membaca halaman lain dulu.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Pendaftaran Murid Baru" };

export default async function SpmbPage() {
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") notFound();

  const batches = await getPublicBatches(ctx.school.id);

  // Hanya kirim yang diperlukan browser. Mengirim objek Prisma utuh akan
  // membawa kolom internal ke HTML tanpa alasan.
  const publicBatches: PublicBatch[] = batches.map((b) => ({
    id: b.id,
    name: b.name,
    openDate: b.openDate.toISOString(),
    closeDate: b.closeDate.toISOString(),
    isOpen: b.isOpen,
    phase: b.phase,
    description: b.description,
    requirements: b.requirements,
    paths: b.paths.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      registrationFee: p.registrationFee,
      quota: p.quota,
      filled: p.filled,
      remaining: p.remaining,
      isFull: p.isFull,
      requirements: p.requirements,
    })),
  }));

  // `phase` dihitung di data layer (baca DB + jam server), bukan di sini —
  // supaya halaman dan form tidak pernah berbeda pendapat soal "masih buka?".
  const open = publicBatches.filter((b) => b.isOpen);
  const closed = publicBatches.filter((b) => !b.isOpen);

  return (
    <Section>
      <SectionHeading
        title="Pendaftaran Murid Baru"
        subtitle={`${ctx.school.name} · tahun ajaran berjalan`}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <SiteButton href="/spmb/status" variant="outline">
          Sudah mendaftar? Cek status
        </SiteButton>
        {ctx.school.phone && (
          <SiteButton href={`tel:${ctx.school.phone}`} variant="outline">
            Tanya panitia: {ctx.school.phone}
          </SiteButton>
        )}
      </div>

      {publicBatches.length === 0 && (
        <BlockEmpty
          message="Pendaftaran belum dibuka"
          hint="Silakan hubungi sekolah untuk informasi jadwal pendaftaran berikutnya."
        />
      )}

      {open.length > 0 && <SpmbForm batches={open} />}

      {open.length === 0 && closed.length > 0 && (
        <div className="mt-4 border-l-4 border-amber-600 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Seluruh gelombang pendaftaran sudah ditutup. Hubungi sekolah untuk
          informasi gelombang berikutnya.
        </div>
      )}

      {/* Gelombang tertutup ditampilkan sebagai riwayat — orang tua sering ingin
          tahu gelombang sebelumnya buka kapan, untuk memperkirakan jadwal. */}
      {closed.length > 0 && (
        <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--site-border)" }}>
          <h2 className="font-[family-name:var(--site-heading-font)] text-base font-semibold text-[var(--site-muted)]">
            Gelombang yang sudah ditutup
          </h2>
          <ul className="mt-3 space-y-2">
            {closed.map((b) => (
              <li key={b.id} className="text-sm text-[var(--site-muted)]">
                <span className="font-medium text-[var(--site-text)]">{b.name}</span>
                {" — "}
                {formatSiteDate(b.openDate)} s.d. {formatSiteDate(b.closeDate)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-8 text-xs text-[var(--site-muted)]">
        Dengan mendaftar, orang tua/wali menyatakan data yang diisi benar dan
        bersedia dihubungi sekolah melalui WhatsApp di nomor yang diberikan.
        Lihat{" "}
        <Link href="/kebijakan-privasi" className="underline">
          kebijakan privasi
        </Link>{" "}
        bila tersedia.
      </p>
    </Section>
  );
}
