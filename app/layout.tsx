import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

