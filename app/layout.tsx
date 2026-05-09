import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { GalleryProvider } from '@/lib/store';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Picker Photo',
  description: 'AI-powered photo curator that selects and edits photos in the style of a master photographer.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body className={`${inter.className} bg-zinc-950 text-white min-h-screen`}>
        <GalleryProvider>{children}</GalleryProvider>
      </body>
    </html>
  );
}
