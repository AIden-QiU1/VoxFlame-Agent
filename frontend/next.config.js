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
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    // Expose build-time envs to the browser bundle.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ICP_BEIAN_NUMBER: process.env.NEXT_PUBLIC_ICP_BEIAN_NUMBER,
    NEXT_PUBLIC_ICP_BEIAN_URL: process.env.NEXT_PUBLIC_ICP_BEIAN_URL,
    NEXT_PUBLIC_ICP_BEIAN_COMPANY_NAME: process.env.NEXT_PUBLIC_ICP_BEIAN_COMPANY_NAME,
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
  },
  async headers() {
    const securityHeaders = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Content-Security-Policy',
        value: "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; media-src 'self' blob: data:; manifest-src 'self'; worker-src 'self' blob:; form-action 'self'; upgrade-insecure-requests",
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), display-capture=(), geolocation=(), payment=(), usb=(), microphone=(self)',
      },
    ]

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  }
};

module.exports = withPWA(nextConfig);
