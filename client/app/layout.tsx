import type { Metadata } from 'next';
import { Public_Sans, Space_Grotesk } from 'next/font/google';
import './globals.css';
import Navbar from '../components/Navbar';

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-body',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'FlowIntel Control Room',
  description: 'Smart municipal water distribution monitoring on a live geographic map.',
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${publicSans.variable} ${spaceGrotesk.variable}`}>
        {children}
        <Navbar />
      </body>
    </html>
  );
}
