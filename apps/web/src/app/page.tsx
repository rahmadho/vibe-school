import PublicLayout from "@/app/(public)/layout";
import PublicHome from "@/app/(public)/page";

/**
 * Halaman depan "/".
 *
 * KENAPA TIDAK LAGI `redirect()`:
 * Rute ini dan `(public)/page.tsx` sama-sama menyelesaikan ke "/". Sebelumnya
 * berkas ini hanya `redirect(session ? "/dashboard" : "/login")`, sehingga web
 * sekolah publik TIDAK PERNAH bisa dibuka — setiap kunjungan ke "/" dilempar ke
 * halaman login, termasuk saat preview pengembangan.
 *
 * Sekarang "/" menampilkan web sekolah publik untuk semua orang (termasuk yang
 * sedang login, supaya preview bisa dilihat tanpa keluar akun). Dasbor tetap di
 * "/dashboard".
 *
 * Layout publik dipanggil manual karena berkas ini berada DI LUAR grup
 * `(public)`, jadi `(public)/layout.tsx` tidak otomatis membungkusnya.
 *
 * TODO: hapus salah satu berkas saat sempat — dua halaman yang menyelesaikan ke
 * rute sama adalah utang, bukan pola. Keduanya kini identik, jadi tidak ada
 * perilaku yang bergantung pada mana yang dipilih Next.js.
 */
export const dynamic = "force-dynamic";

// Judul & deskripsi dari layout publik (butuh nama sekolah dari host).
export { generateMetadata } from "@/app/(public)/layout";

export default function Home() {
  return (
    <PublicLayout>
      <PublicHome />
    </PublicLayout>
  );
}
