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
};

export default nextConfig;
