import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveSchoolFromRequest } from "@/lib/site-server";
import { Section, SectionHeading } from "@/components/site/site-ui";
import { StatusForm } from "./status-form";

/**
 * Halaman cek status pendaftaran SPMB.
 *
 * Halaman ini dipakai orang tua berulang kali selama masa seleksi — sering dari
 * ponsel, sering tengah malam. Karena itu ia sederhana dan tidak menuntut
 * masuk akun: cukup nomor pendaftaran + nomor HP wali.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Cek Status Pendaftaran" };

export default async function StatusPage() {
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") notFound();

  return (
    <Section>
      <SectionHeading
        title="Cek Status Pendaftaran"
        subtitle={`Masukkan nomor pendaftaran Anda untuk ${ctx.school.name}`}
      />

      <div className="mx-auto max-w-xl">
        <StatusForm />

        <p className="mt-6 text-sm text-[var(--site-muted)]">
          Belum mendaftar?{" "}
          <Link href="/spmb" className="underline">
            Buka halaman pendaftaran
          </Link>
          .
        </p>
      </div>
    </Section>
  );
}
