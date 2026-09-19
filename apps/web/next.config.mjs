/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Multi-tenant: siapkan untuk subdomain per sekolah (nanti di middleware)
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
