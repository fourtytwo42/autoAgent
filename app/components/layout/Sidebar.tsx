'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card } from '@heroui/react';

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
    <div style={{
      width: '256px',
      backgroundColor: '#18181b',
      color: 'white',
      minHeight: '100vh',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #27272a',
    }}>
      <h1 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '32px',
        color: 'white',
      }}>AutoAgent</h1>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href === '/' && pathname === '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                textDecoration: 'none',
                color: isActive ? 'white' : '#a1a1aa',
                backgroundColor: isActive ? '#27272a' : 'transparent',
                transition: 'all 0.2s',
                fontWeight: isActive ? '600' : '500',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#27272a';
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#a1a1aa';
                }
              }}
            >
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
