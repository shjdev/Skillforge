import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Inter, Newsreader } from 'next/font/google';
import { ClientShell } from './client-shell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
});
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['300', '400', '500'],
  variable: '--font-newsreader',
});

export const metadata: Metadata = {
  manifest: '/manifest.json',
  title: { default: 'SkillForge', template: '%s · SkillForge' },
  description: 'Transforme tes livres et documents en un parcours quotidien de leçons et de quiz.',
  icons: { icon: '/icon.svg' },
  authors: [{ name: 'SAMAN Hugues Junior (SHJ)' }],
};

export const viewport: Viewport = {
  themeColor: '#f6f3ee',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${plexMono.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
