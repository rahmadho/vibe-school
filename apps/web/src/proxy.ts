import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { allowDevFallback } from "@/lib/site-host";

// Pada Next.js 16 berkas proxy SELALU berjalan di runtime Node.js, jadi tidak
// perlu (dan tidak boleh) ada `export const runtime`. Ini justru menguntungkan:
// auth → password-hash memakai `crypto` bawaan Node yang tidak tersedia di Edge.

/** Nama cookie yang menyimpan sekolah pilihan saat preview pengembangan. */
export const DEV_SCHOOL_COOKIE = "dev_school";

/**
 * Proxy (sebelumnya bernama `middleware.ts`).
 *
 * Next.js 16 mengganti konvensi `middleware` → `proxy`; fungsi & `config`
 * identik, hanya nama berkas yang berubah. Berkas ini WAJIB tetap di `src/`.
 *
 * 1. Proteksi rute: /dashboard/* wajib login; /login ditolak bila sudah login.
 * 2. JEMBATAN PREVIEW (hanya di luar produksi): menerjemahkan `?school=<slug>`
 *    menjadi header `x-dev-school` yang dibaca `resolveSchoolFromRequest()`,
 *    sekaligus mengingatnya di cookie agar bertahan saat pengunjung berpindah
 *    halaman — tautan menu bersifat relatif (`/berita`, `/spmb`) dan tidak
 *    membawa `?school=`, jadi tanpa cookie preview akan putus di klik pertama.
 *
 * Kenapa lewat header, bukan membaca searchParams di setiap halaman: halaman
 * publik adalah Server Components dan tidak menerima `searchParams` secara
 * seragam; menambahkannya di 7 berkas berarti 7 tempat untuk lupa. Satu
 * terjemahan di sini membuat preview bekerja di SEMUA halaman publik sekaligus
 * — dan mati total di produksi karena `allowDevFallback()` menolak.
 */
export default auth((req: NextRequest & { auth: unknown }) => {
  const isLoggedIn = Boolean((req as { auth?: unknown }).auth);
  const { pathname, searchParams } = req.nextUrl;

  const isProtected = pathname.startsWith("/dashboard");
  const isAuthPage = pathname === "/login";

  if (isProtected && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  if (!allowDevFallback()) return NextResponse.next();

  // Sekolah dari ?school= (prioritas) atau dari kunjungan sebelumnya (cookie).
  const fromQuery = searchParams.get("school");
  const school = fromQuery ?? req.cookies.get(DEV_SCHOOL_COOKIE)?.value ?? null;
  if (!school) return NextResponse.next();

  const headers = new Headers(req.headers);
  headers.set("x-dev-school", school);
  const res = NextResponse.next({ request: { headers } });

  // Simpan pilihan agar bertahan saat berpindah halaman. `?school=` yang
  // eksplisit boleh menimpa; cookie hanya diingat selama pengembangan.
  if (fromQuery) {
    res.cookies.set(DEV_SCHOOL_COOKIE, fromQuery, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
});

export const config = {
  // Halaman + aset non-statis. `/api`, `/uploads`, dan `_next/*` dilewati:
  // endpoint auth, webhook gateway, dan penyajian berkas unggahan tidak
  // memanggil resolveSchoolFromRequest(), jadi tidak ada gunanya menambah satu
  // lapisan di depannya.
  matcher: ["/((?!api|uploads|_next/static|_next/image|favicon.ico).*)"],
};
