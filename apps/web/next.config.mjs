/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
