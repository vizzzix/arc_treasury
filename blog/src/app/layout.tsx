import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Arc Treasury Blog',
    template: '%s | Arc Treasury Blog',
  },
  description:
    'Insights on DeFi yield, stablecoins, and treasury management on Arc Network.',
  metadataBase: new URL('https://arctreasury.biz'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Arc Treasury Blog',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@arctreasury',
    creator: '@arctreasury',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground`}>
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="mx-auto max-w-2xl px-6 h-14 flex items-center justify-between">
            <a href="/blog" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
                <span className="text-primary text-xs font-bold">A</span>
              </div>
              <span className="text-sm font-medium">Arc Treasury</span>
            </a>
            <a
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Open App
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-6 py-12">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-2xl px-6 py-8 flex items-center justify-between text-xs text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} Arc Treasury</span>
            <div className="flex items-center gap-4">
              <a href="/" className="hover:text-foreground transition-colors">App</a>
              <a href="/faq" className="hover:text-foreground transition-colors">FAQ</a>
              <a href="/litepaper" className="hover:text-foreground transition-colors">Litepaper</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
