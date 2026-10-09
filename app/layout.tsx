import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import DevOverlay from '@/components/DevOverlay';
import { ToastProvider } from '@/components/ui/Toast';
import { isDevOverlayEnabled } from '@/lib/dev-overlay-auth';

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ambassades de Guérison',
  description: 'Trouvez une ambassade de guérison près de chez vous pour les lives de David Thery',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ambassades',
  },
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} h-full antialiased`}>
      <body className={`${geist.className} min-h-full flex flex-col`}>
        <ToastProvider>
          {children}
          {isDevOverlayEnabled() && <DevOverlay />}
        </ToastProvider>
      </body>
    </html>
  );
}
