import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Middleware route protection.
 * - Belum login & akses /dashboard/* → redirect ke /login
 * - Sudah login & akses /login → redirect ke /dashboard
 *
 * Otorisasi per-MODUL dilakukan di layout/halaman (butuh role → modul mapping),
 * karena middleware sengaja dibuat ringan (tanpa query DB).
 */
export default auth((req: NextRequest & { auth: unknown }) => {
  const isLoggedIn = Boolean((req as { auth?: unknown }).auth);
  const { pathname } = req.nextUrl;

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

  return NextResponse.next();
});

export const config = {
  // Lindungi semua kecuali aset statis & endpoint auth.
  matcher: ["/dashboard/:path*", "/login"],
};
