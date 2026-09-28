import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GantiPasswordForm } from "./ganti-password-form";

export const metadata = { title: "Ganti Password" };

/**
 * Halaman ganti password wajib.
 *
 * Dipakai akun yang dibuat massal (siswa & wali) dengan password awal berupa
 * tanggal lahir. Sampai password diganti, halaman ini satu-satunya yang bisa
 * diakses — lihat gerbangnya di layout portal & layout dashboard.
 */
export default async function GantiPasswordPage() {
  const session = await auth();

  // Tanpa sesi tidak ada yang bisa diganti.
  if (!session?.user) redirect("/login");

  // Sudah pernah ganti → tidak perlu di sini lagi.
  if (!session.user.mustChangePassword) redirect("/portal");

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-ink">Ganti password dulu</h1>
        <p className="mt-2 text-sm text-slate">
          Akun Anda memakai password awal berupa tanggal lahir. Demi keamanan,
          ganti dulu sebelum melanjutkan.
        </p>

        <div className="mt-8">
          <GantiPasswordForm />
        </div>
      </div>
    </main>
  );
}
