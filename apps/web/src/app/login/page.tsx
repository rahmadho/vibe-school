import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk" };

/**
 * Halaman login — momen brand utama.
 *
 * Design note (frontend-design):
 *  - Hero = hal paling khas dari dunia sekolah: papan tulis dengan daftar
 *    kehadiran agenda hari ini. Bukan gradient + kartu SaaS generik.
 *  - Tipografi Fraunces besar membawa kepribadian; sisi kiri memuat "isi"
 *    nyata (agenda), sisi kanan form.
 *  - Hijau papan tulis dipakai hemat: hanya aksen & tombol utama.
 */
export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Panel kiri — papan tulis sekolah */}
      <section className="relative hidden flex-col justify-between bg-board px-12 py-14 text-white lg:flex">
        <div>
          <p className="font-display text-2xl">School App</p>
          <p className="mt-1 text-sm text-white/70">
            Sistem informasi sekolah, dari pendaftaran sampai rapor
          </p>
        </div>

        {/* "Papan tulis": agenda hari ini, ditulis dengan gaya tulisan kapur */}
        <div className="my-10">
          <p className="text-sm uppercase tracking-wide text-white/60">
            Agenda hari ini
          </p>
          <ol className="mt-4 space-y-3 font-display text-xl text-white/95">
            <li className="flex gap-4">
              <span className="tabular-display text-white/50">07:00</span>
              <span>Upacara bendera — lapangan utama</span>
            </li>
            <li className="flex gap-4">
              <span className="tabular-display text-white/50">09:30</span>
              <span>Rapat wali kelas 7A–7C</span>
            </li>
            <li className="flex gap-4">
              <span className="tabular-display text-white/50">13:00</span>
              <span>Batas akhir pembayaran SPP bulan ini</span>
            </li>
          </ol>
        </div>

        <p className="max-w-prose text-sm text-white/60">
          Satu tempat untuk absensi, nilai, tagihan, dan kabar sekolah —
          dipakai bersama oleh guru, bendahara, dan orang tua.
        </p>

        {/* motif garis kapur halus (struktur, bukan dekorasi) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 27px, #fff 28px)",
          }}
        />
      </section>

      {/* Panel kanan — form */}
      <section className="flex items-center justify-center bg-paper px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl text-ink">Masuk ke akun Anda</h1>
          <p className="mt-2 text-sm text-slate">
            Staf dan guru memakai email. Siswa dan orang tua memakai NIS.
          </p>

          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>

          <div className="mt-10 rounded-lg border border-chalk bg-white p-4">
            <p className="text-xs font-medium text-ink">Akun demo</p>
            <ul className="mt-2 space-y-1 text-xs text-slate">
              <li>Admin SMP · admin@smpn1.sch.id</li>
              <li>Admin SD · admin@tunasharapan.sch.id</li>
              <li>Super admin · admin@schoolapp.local</li>
              <li className="pt-1 text-slate-light">
                Password semua akun demo: password12345
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

/** Fallback saat form (yang membaca query string) belum siap. */
function LoginFormSkeleton() {
  return (
    <div className="mt-8 space-y-4" aria-hidden>
      <div className="h-[62px] rounded border border-chalk bg-chalk/20" />
      <div className="h-[62px] rounded border border-chalk bg-chalk/20" />
      <div className="h-10 rounded bg-chalk/30" />
    </div>
  );
}
