import type { Metadata, Viewport } from 'next'
import { LegacyPwaCleanup } from '@/components/pwa/LegacyPwaCleanup'
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/hooks/useAuth'
import './globals.css'

const siteOrigin = process.env.VOXFLAME_PUBLIC_BASE_URL || 'https://voxember.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: '燃言 - 让每个声音都被听见',
  description: '专为构音障碍患者打造的开源语音识别项目，让AI听懂你的声音',
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
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: siteOrigin,
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
        <meta name="msapplication-TileColor" content="#F59E0B" />
      </head>
      <body className="antialiased">
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
        >
          跳转到主要内容
        </a>
        <AuthProvider>{children}</AuthProvider>
        <LegacyPwaCleanup />
        <Toaster />
      </body>
    </html>
  )
}
