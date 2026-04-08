/** @type {import('next').NextConfig} */
const normalizedPwaFlag = (process.env.VOXFLAME_ENABLE_PWA || "").trim().toLowerCase();
const normalizedPwaDevFlag = (process.env.VOXFLAME_ENABLE_PWA_DEV || "").trim().toLowerCase();
const pwaEnabled = !["0", "false", "no"].includes(normalizedPwaFlag);
const pwaEnabledInDevelopment = ["1", "true", "yes"].includes(normalizedPwaDevFlag);
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  register: false,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable:
    !pwaEnabled ||
    (process.env.NODE_ENV === "development" && !pwaEnabledInDevelopment),
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig = {
  // Generate standalone output for Docker runtime
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    // Expose build-time envs to the browser bundle.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_PWA_ENABLED: pwaEnabled ? "1" : "0",
    NEXT_PUBLIC_PWA_ALLOW_LOCALHOST: pwaEnabledInDevelopment ? "1" : "0",
  },
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://backend:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/rtc/:path*',
        destination: 'http://livekit-server:7880/rtc/:path*',
      }
    ]
  }
};

module.exports = withPWA(nextConfig);
