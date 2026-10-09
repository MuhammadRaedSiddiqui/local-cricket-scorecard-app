import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import * as Sentry from '@sentry/nextjs'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cricklive-seven.vercel.app'

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl),
    title: 'CrickLive - Local Cricket Scorecards',
    description: 'Create matches, record every ball, and share live cricket scorecards with your local league.',
    keywords: ['cricket', 'scorecard', 'local cricket', 'live scores', 'match scoring'],
    openGraph: {
      title: 'CrickLive - Local Cricket Scorecards',
      description: 'Bring local cricket online with ball-by-ball scoring and live match updates.',
      url: siteUrl,
      siteName: 'CrickLive',
      locale: 'en_US',
      type: 'website',
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
    other: { ...Sentry.getTraceData() },
  }
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-white text-gray-900">
        {children}
      </body>
    </html>
  )
}