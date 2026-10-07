import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'SVD Fitness OS — Train smart. Move better.', template: '%s · SVD Fitness OS' },
  description: 'Personalized workouts, 3D exercise guidance, nutrition intelligence and measurable progress — all in one fitness platform.',
};

export const viewport: Viewport = { themeColor: '#0b0d0f', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">
        {children}
        <Toaster theme="dark" position="top-right" toastOptions={{ classNames: { toast: '!bg-elevated !border-white/10 !text-foreground' } }} />
      </body>
    </html>
  );
}
