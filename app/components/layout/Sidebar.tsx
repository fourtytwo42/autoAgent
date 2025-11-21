'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Conversation', href: '/', icon: '💬' },
  { name: 'Blackboard', href: '/blackboard', icon: '📋' },
  { name: 'Agents', href: '/agents', icon: '🤖' },
  { name: 'Models', href: '/models', icon: '🧠' },
  { name: 'Timeline', href: '/timeline', icon: '⏱️' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen p-4">
      <h1 className="text-xl font-bold mb-8">AutoAgent</h1>
      <nav className="space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-2 px-4 py-2 rounded ${
                isActive ? 'bg-gray-700' : 'hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

