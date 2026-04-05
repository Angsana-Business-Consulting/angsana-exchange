'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { defaultTheme } from '@/config/theme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UserRole } from '@/types';

/**
 * Determine where to redirect after login based on role.
 *
 * - internal-admin → /portfolio (cross-client landing)
 * - internal-user  → /my-clients (assigned clients landing)
 * - client-approver / client-viewer → /clients/{clientId}/campaigns
 */
function getRedirectPath(role: UserRole, clientId: string | null): string {
  switch (role) {
    case 'internal-admin':
      return '/portfolio';
    case 'internal-user':
      return '/my-clients';
    case 'client-approver':
    case 'client-viewer':
      return clientId ? `/clients/${clientId}/campaigns` : '/login';
    default:
      return '/login';
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Authenticate with Firebase
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // 2. Get the ID token (includes custom claims)
      const idToken = await credential.user.getIdToken(true);

      // 3. Send token to server to create session cookie
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      // 4. Parse the token to get claims for redirect
      const tokenResult = await credential.user.getIdTokenResult();
      const role = (tokenResult.claims.role as UserRole) || 'client-viewer';
      const clientId = (tokenResult.claims.clientId as string) || null;

      // 5. Redirect based on role
      const redirectPath = getRedirectPath(role, clientId);
      router.push(redirectPath);
    } catch (err) {
      console.error('Login error:', err);
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background-dark)]">
      <div className="w-full max-w-sm space-y-8 px-6">
        {/* Logo */}
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={defaultTheme.logoReversedPath}
            alt={defaultTheme.name}
            className="h-12 w-auto"
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
          </div>

          {error && (
            <p className="text-sm text-[var(--accent-magenta)]">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full bg-[var(--accent-gold)] text-[var(--foreground)] hover:bg-[var(--accent-gold)]/90"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-xs text-white/40">
          {defaultTheme.name} Exchange
        </p>
      </div>
    </div>
  );
}
