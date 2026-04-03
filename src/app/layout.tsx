import type { Metadata } from 'next';
import { Quicksand } from 'next/font/google';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';
import { defaultTheme } from '@/config/theme';
import './globals.css';

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-quicksand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Angsana Exchange',
  description: 'Client portal for Angsana LGaaS platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={quicksand.variable}>
      <body className={quicksand.className}>
        <ThemeProvider theme={defaultTheme}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
