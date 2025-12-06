import type { Metadata } from 'next'
import { Space_Grotesk, Noto_Sans_KR } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { Analytics } from "@vercel/analytics/next"

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const body = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Manifesto Playground',
  description: 'Interactive playground for Manifesto DSL schemas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={`${display.variable} ${body.variable}`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
