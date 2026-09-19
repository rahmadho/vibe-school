import Link from "next/link";
import { resolveSchoolFromRequest } from "@/lib/site-server";

/**
 * Halaman tidak ditemukan untuk web sekolah.
 *
 * Dua hal penting di sini:
 *  1. Pengunjung diberi JALAN KELUAR (tautan ke beranda dan berita), bukan
 *     sekadar "404". Halaman buntu membuat pengunjung pergi.
 *  2. Tidak ada jejak teknis (nama tabel, pesan galat) yang bocor ke publik.
 */
export default async function PublicNotFound() {
  const ctx = await resolveSchoolFromRequest();
  const schoolName = ctx.status === "ok" ? ctx.school.name : null;

  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center">
      <p className="font-mono text-sm text-[var(--site-muted)]">404</p>
      <h1 className="mt-2 font-[family-name:var(--site-heading-font)] text-2xl font-semibold text-[var(--site-text)]">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-3 text-sm text-[var(--site-muted)]">
        Alamat yang Anda buka tidak ada atau sudah dipindahkan.
        {schoolName ? ` Mungkin isinya ada di halaman lain ${schoolName}.` : ""}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="inline-block px-4 py-2 text-sm font-semibold text-[var(--site-primary-text)]"
          style={{
            backgroundColor: "var(--site-primary)",
            borderRadius: "var(--site-radius-button)",
          }}
        >
          Beranda
        </Link>
        <Link
          href="/berita"
          className="inline-block border px-4 py-2 text-sm text-[var(--site-text)]"
          style={{
            borderColor: "var(--site-border)",
            borderRadius: "var(--site-radius-button)",
          }}
        >
          Berita
        </Link>
        <Link
          href="/spmb"
          className="inline-block border px-4 py-2 text-sm text-[var(--site-text)]"
          style={{
            borderColor: "var(--site-border)",
            borderRadius: "var(--site-radius-button)",
          }}
        >
          Pendaftaran
        </Link>
      </div>
    </div>
  );
}
