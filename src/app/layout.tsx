import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Newsreader } from 'next/font/google';
import { L } from '@/lib/theme';
import { ClientShell } from './client-shell';
import './globals.css';

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono-ui',
});
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['300', '400', '500'],
  variable: '--font-serif-display',
});

export const metadata: Metadata = {
  manifest: '/manifest.json',
  title: 'SkillForge',
  description: 'Apprentissage quotidien structuré : leçons, quiz, révision.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#1a1a18',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${plexMono.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <body
        style={{ background: L.paper, color: L.ink, fontFamily: 'var(--font-mono-ui)' }}
        className="min-h-screen antialiased flex"
        suppressHydrationWarning
      >
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
