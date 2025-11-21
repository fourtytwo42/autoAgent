import type { Metadata } from 'next';
import './globals.css';
import MainLayout from './components/layout/MainLayout';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'AutoAgent - LLM Hive System',
  description: 'A persistent, self-evolving LLM hive system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} style={{ 
      fontFamily: 'var(--font-inter), system-ui, sans-serif',
    }}>
      <body className={`${inter.variable} h-screen overflow-hidden`}>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}

