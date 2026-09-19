import type { Metadata } from "next";
import { Public_Sans, Fraunces } from "next/font/google";
import "./globals.css";

/**
 * Tipografi:
 *  - Public Sans → UI (netral, sangat terbaca, karakter sipil/pemerintahan —
 *    cocok untuk aplikasi administrasi sekolah).
 *  - Fraunces    → display/angka penting (serif hangat, seperti cetakan rapor).
 * Dua keluarga, peran jelas berbeda. Sengaja BUKAN Inter/Geist (default AI).
 */
const sans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "School App",
    template: "%s · School App",
  },
  description: "Sistem Informasi Sekolah — akademik, keuangan, dan komunikasi.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
