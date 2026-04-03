'use client';

import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';

/**
 * Derive page title from pathname.
 */
function getPageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];

  if (!last || last === 'dashboard') return 'Dashboard';
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-lg font-bold text-[var(--foreground)]">{title}</h1>

      <div className="flex items-center gap-4">
        <button
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
