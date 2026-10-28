'use client';

import { useRouter } from 'next/navigation';

export default function NavActions() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button type="button" className="logout-button" onClick={handleLogout}>
      登出
    </button>
  );
}
