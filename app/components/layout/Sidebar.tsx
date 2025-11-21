'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Conversation', href: '/', icon: '💬' },
  { name: 'Blackboard', href: '/blackboard', icon: '📋' },
  { name: 'Agents', href: '/agents', icon: '🤖' },
  { name: 'Models', href: '/models', icon: '🧠' },
  { name: 'Config', href: '/config', icon: '⚙️' },
  { name: 'Timeline', href: '/timeline', icon: '⏱️' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-gray-800 text-white min-h-screen p-6 flex flex-col border-r border-gray-700">
      <h1 className="text-2xl font-bold mb-8 text-white">AutoAgent</h1>
      <nav className="space-y-2 flex-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href === '/' && pathname === '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive 
                  ? 'bg-gray-700 text-white shadow-md' 
                  : 'hover:bg-gray-700 text-gray-300 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

