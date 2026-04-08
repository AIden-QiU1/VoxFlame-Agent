import type { Metadata, Viewport } from 'next'
import { LocalRuntimeReset } from '@/components/pwa/LocalRuntimeReset'
import { PWAStatusCenter } from '@/components/pwa'
import { Toaster } from "@/components/ui/toaster"
import './globals.css'

const pwaEnabled = process.env.NEXT_PUBLIC_PWA_ENABLED === '1'
const allowLocalhostPwa = process.env.NEXT_PUBLIC_PWA_ALLOW_LOCALHOST === '1'
const shouldResetLocalRuntime = !pwaEnabled || !allowLocalhostPwa
const LOCAL_RUNTIME_RESET_SESSION_KEY = 'voxflame-local-runtime-reset-session-v1'
const LOCAL_RUNTIME_RESET_BOOTSTRAP = `
(() => {
  if (typeof window === 'undefined') return;

  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return;

  if (window.sessionStorage.getItem('${LOCAL_RUNTIME_RESET_SESSION_KEY}') === '1') {
    return;
  }

  const resetRuntimeState = async () => {
    const registrations =
      'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistrations()
        : [];
    const cacheNames = 'caches' in window ? await caches.keys() : [];
    const hadRuntimeState = registrations.length > 0 || cacheNames.length > 0;

    if (registrations.length > 0) {
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window && cacheNames.length > 0) {
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    window.sessionStorage.setItem('${LOCAL_RUNTIME_RESET_SESSION_KEY}', '1');

    if (hadRuntimeState) {
      window.location.reload();
    }
  };

  void resetRuntimeState().catch((error) => {
    console.error('[LocalRuntimeResetBootstrap] Failed to clear localhost runtime state:', error);
  });
})();
`

export const metadata: Metadata = {
  metadataBase: new URL('https://ranyan.app'),
  title: '燃言 - 让每个声音都被听见',
  description: '专为构音障碍患者打造的开源语音识别项目，让AI听懂你的声音',
  manifest: pwaEnabled ? '/manifest.json' : undefined,
  applicationName: '燃言',
  keywords: ['语音识别', '构音障碍', '无障碍', 'AI', '开源', 'dysarthria', 'speech recognition'],
  authors: [{ name: '燃言团队' }],
  creator: '燃言开源社区',
  publisher: '燃言',
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  appleWebApp: pwaEnabled
    ? {
        capable: true,
        statusBarStyle: 'default',
        title: '燃言',
      }
    : undefined,
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/apple-touch-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/apple-touch-icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/icons/apple-touch-icon-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/icons/apple-touch-icon-114x114.png', sizes: '114x114', type: 'image/png' },
      { url: '/icons/apple-touch-icon-76x76.png', sizes: '76x76', type: 'image/png' },
      { url: '/icons/apple-touch-icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icons/apple-touch-icon-60x60.png', sizes: '60x60', type: 'image/png' },
      { url: '/icons/apple-touch-icon-57x57.png', sizes: '57x57', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/safari-pinned-tab.svg', color: '#F59E0B' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://ranyan.app',
    siteName: '燃言',
    title: '燃言 - 让每个声音都被听见',
    description: '专为构音障碍患者打造的开源语音识别项目',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '燃言 - 让每个声音都被听见',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '燃言 - 让每个声音都被听见',
    description: '专为构音障碍患者打造的开源语音识别项目',
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F59E0B' },
    { media: '(prefers-color-scheme: dark)', color: '#D97706' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  colorScheme: 'light dark',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" dir="ltr">
      <head>
        {/* MS 应用磁贴配置 */}
        <meta name="msapplication-TileColor" content="#F59E0B" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        {pwaEnabled ? <meta name="mobile-web-app-capable" content="yes" /> : null}
        {shouldResetLocalRuntime ? (
          <script dangerouslySetInnerHTML={{ __html: LOCAL_RUNTIME_RESET_BOOTSTRAP }} />
        ) : null}
      </head>
      <body className="antialiased">
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
        >
          跳转到主要内容
        </a>
        {children}
        {shouldResetLocalRuntime ? <LocalRuntimeReset /> : null}
        {pwaEnabled ? <PWAStatusCenter /> : null}
        <Toaster />
      </body>
    </html>
  )
}
