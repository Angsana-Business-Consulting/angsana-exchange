'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, ChevronDown, Search } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth/AuthContext';

/**
 * Derive page title from pathname.
 */
// Friendly labels for URL segments that don't capitalise cleanly
const SEGMENT_LABELS: Record<string, string> = {
  sowhats: 'So Whats',
  checkins: 'Check-ins',
  dnc: 'DNC / MSA-PSL',
};

function getPageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);

  // Handle /clients/{clientId}/{moduleName} pattern
  if (segments[0] === 'clients' && segments.length >= 3) {
    const pageName = segments[2];
    if (SEGMENT_LABELS[pageName]) return SEGMENT_LABELS[pageName];
    return pageName.charAt(0).toUpperCase() + pageName.slice(1);
  }

  const last = segments[segments.length - 1];
  if (!last) return 'Exchange';

  // Convert kebab-case to title case
  return last
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Role display labels.
 */
const ROLE_LABELS: Record<string, string> = {
  'internal-admin': 'Admin',
  'internal-user': 'Internal',
  'client-approver': 'Approver',
  'client-viewer': 'Viewer',
};

/**
 * Client selector dropdown for internal users.
 */
function ClientSelector({
  assignedClients,
  activeClientId,
}: {
  assignedClients: string[];
  activeClientId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // For admin with ["*"], we can't enumerate all clients from claims alone.
  // In Slice 1, we show a static list. This will be fetched from Firestore later.
  const isWildcard = assignedClients.includes('*');
  const displayClients = isWildcard
    ? ['cegid-spain', 'wavix'] // Static for Slice 1
    : assignedClients;

  const filtered = displayClients.filter((c) =>
    c.toLowerCase().includes(filter.toLowerCase())
  );

  function selectClient(clientId: string) {
    setOpen(false);
    setFilter('');
    // Save to localStorage for session persistence
    localStorage.setItem('lastSelectedClient', clientId);
    router.push(`/clients/${clientId}/campaigns`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
      >
        <span className="text-[var(--foreground)]">
          {activeClientId || 'Select Client'}
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
          {/* Search */}
          <div className="border-b border-gray-100 p-2">
            <div className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1">
              <Search className="h-4 w-4 text-[var(--muted)]" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search clients..."
                className="w-full bg-transparent text-sm outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* Client list */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.map((clientId) => (
              <li key={clientId}>
                <button
                  onClick={() => selectClient(clientId)}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                    clientId === activeClientId
                      ? 'bg-gray-50 font-medium text-[var(--primary)]'
                      : 'text-[var(--foreground)]'
                  }`}
                >
                  {clientId}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-[var(--muted)]">
                No clients found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { displayName, claims } = useAuth();
  const title = getPageTitle(pathname);

  const isInternal = claims.role === 'internal-admin' || claims.role === 'internal-user';

  // Extract active clientId from URL
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const activeClientId = clientMatch ? clientMatch[1] : null;

  async function handleSignOut() {
    try {
      // Clear the session cookie
      await fetch('/api/auth/session', { method: 'DELETE' });
      // Sign out of Firebase client
      await signOut(auth);
      // Redirect to login
      router.push('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-[var(--foreground)]">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Client selector — internal users only */}
        {isInternal && (
          <ClientSelector
            assignedClients={claims.assignedClients || []}
            activeClientId={activeClientId}
          />
        )}

        {/* User info */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--foreground)]">{displayName}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[var(--muted)]">
            {ROLE_LABELS[claims.role] || claims.role}
          </span>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
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
