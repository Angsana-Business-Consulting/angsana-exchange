import { redirect } from 'next/navigation';

/**
 * Root page — redirect to dashboard.
 * When auth is fully wired, this will check session and redirect
 * to /login if unauthenticated.
 */
export default function Home() {
  redirect('/dashboard');
}
