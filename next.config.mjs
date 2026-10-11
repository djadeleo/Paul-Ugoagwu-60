/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Plain <img> tags are used everywhere so we never touch Vercel's image-optimization quota.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
