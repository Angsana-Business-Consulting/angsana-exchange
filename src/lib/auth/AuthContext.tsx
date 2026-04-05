'use client';

import { createContext, useContext } from 'react';
import type { UserContext } from '@/types';

/**
 * AuthContext — provides the authenticated user's context to client components.
 *
 * Populated by the dashboard layout (server component) which reads claims
 * from request headers. Client components consume it via useAuth().
 *
 * This avoids each client component needing its own API call to determine
 * who the user is and what they can access.
 */
const AuthContext = createContext<UserContext | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: UserContext;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access the authenticated user's context.
 * Must be used inside an AuthProvider (i.e., inside the dashboard layout).
 */
export function useAuth(): UserContext {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used inside <AuthProvider>');
  }
  return context;
}
