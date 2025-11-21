import type { Metadata } from 'next';
import './globals.css';
import MainLayout from './components/layout/MainLayout';

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
    <html lang="en" className="dark">
      <body className="dark:bg-gray-900">
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}

