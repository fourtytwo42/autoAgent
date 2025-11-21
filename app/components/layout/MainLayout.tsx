import Sidebar from './Sidebar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
    }}>
      <Sidebar />
      <main style={{ flex: 1, backgroundColor: '#0a0a0a' }}>{children}</main>
    </div>
  );
}
