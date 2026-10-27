/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hasil build "standalone": Next menyertakan hanya dependensi yang dipakai
  // sehingga image Docker jauh lebih ramping dan tidak perlu node_modules penuh.
  // Wajib agar Dockerfile bisa menjalankan .next/standalone/server.js.
  output: "standalone",
  // Multi-tenant: siapkan untuk subdomain per sekolah (nanti di middleware)
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'images.unsplash.com',
          port: '',
          pathname: '/**',
        },
      ],
    },
  // Mode dev saja. Next menolak permintaan aset internal (font, HMR, dsb.) yang
  // datang dari origin berbeda. Saat aplikasi diakses lewat tunnel — satu-satunya
  // cara pratinjau di lingkungan tanpa port publik — penolakan itu membuat
  // hidrasi React gagal: halaman tampak normal, tetapi setiap form jatuh ke
  // submit native sehingga input masuk ke query string dan login tak pernah
  // jalan. Karena itu host tunnel didaftarkan di sini, diambil dari env supaya
  // URL tunnel yang berubah tiap sesi tidak perlu mengubah kode.
  //
  // Bukan celah produksi: `next start` mengabaikan opsi ini.
  allowedDevOrigins: (process.env.DEV_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export default nextConfig;
