/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pg', 'pdf-parse', 'mammoth'],
};

export default nextConfig;
