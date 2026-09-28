import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ambilKonteksPortal } from "@/lib/portal-akses";
import { PortalNav } from "./portal-nav";

export const metadata: Metadata = { title: "Portal Siswa & Orang Tua" };

/**
 * Layout Portal Siswa & Orang Tua.
 *
 * Satu portal untuk keduanya: akun dibuat dari data siswa (username = NIS),
 * dan orang tua memakai akun yang sama. Jadi tidak ada pemilih anak — isi
 * portal selalu milik siswa pemilik akun.
 *
 * Tata letak dioptimalkan untuk PONSEL (lihat .impeccable.md: orang tua
 * membuka portal dari ponsel, sering malam) dan untuk membaca, bukan bekerja.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Akun dengan password awal belum boleh masuk portal.
  if (session.user.mustChangePassword) redirect("/ganti-password");

  const ctx = await ambilKonteksPortal();

  if (ctx.status === "bukan_portal") {
    // Staf/guru punya tempat sendiri.
    redirect("/dashboard");
  }

  if (ctx.status === "tanpa_siswa") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <h1 className="font-display text-2xl text-ink">Akun belum terhubung</h1>
        <p className="mt-3 text-sm text-slate">
          Akun ini belum terhubung ke data siswa. Hubungi tata usaha sekolah
          untuk memperbaikinya.
        </p>
      </main>
    );
  }

  const { anak, peran } = ctx;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-chalk bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center gap-3">
            {anak.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={anak.photoUrl}
                alt=""
                className="h-11 w-11 rounded-full border border-chalk object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="flex h-11 w-11 items-center justify-center rounded-full bg-chalk font-display text-lg text-ink"
              >
                {anak.fullName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate font-display text-lg text-ink">
                {anak.fullName}
              </p>
              <p className="truncate text-xs text-slate">
                {[anak.className, anak.majorName].filter(Boolean).join(" · ") ||
                  anak.nis}
                {" · "}
                {peran === "PARENT" ? "Orang tua/wali" : "Siswa"}
              </p>
            </div>
          </div>

          <PortalNav />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>

      <footer className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        <p className="text-xs text-slate-light">{anak.schoolName}</p>
      </footer>
    </div>
  );
}
