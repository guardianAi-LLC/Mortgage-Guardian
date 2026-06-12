import { type Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import { QueryProvider } from '@/components/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const metadataBase = new URL(
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
)

export const metadata: Metadata = {
  metadataBase,
  title: 'Mortgage Guardian — AI-Powered Mortgage Audit',
  description: 'AI-powered forensic audit that detects mortgage servicer violations and generates legal documents.',
  openGraph: {
    title: 'Mortgage Guardian — AI-Powered Mortgage Audit',
    description: 'AI-powered forensic audit that detects mortgage servicer violations and generates legal documents.',
    type: 'website',
    siteName: 'Mortgage Guardian',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mortgage Guardian — AI-Powered Mortgage Audit',
    description: 'AI-powered forensic audit that detects mortgage servicer violations and generates legal documents.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Session policy (lifetime, inactivity timeout, multi-session, sign-out URL)
    // and the backend webhook subscription are configured in the Clerk Dashboard.
    // See docs/AUTH_SESSION_CONFIG.md for the required Dashboard values.
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
