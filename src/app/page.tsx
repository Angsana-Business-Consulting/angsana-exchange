import { redirect } from 'next/navigation';
import { getUserContext, isInternalRole } from '@/lib/auth/server';

/**
 * Root page — reads the authenticated user's role and redirects
 * to the appropriate landing page.
 *
 * - internal-admin  → /portfolio
 * - internal-user   → /my-clients
 * - client-approver → /clients/{clientId}/campaigns
 * - client-viewer   → /clients/{clientId}/campaigns
 */
export default async function Home() {
  const user = await getUserContext();
  const { role, clientId } = user.claims;

  if (role === 'internal-admin') {
    redirect('/portfolio');
  }

  if (role === 'internal-user') {
    redirect('/my-clients');
  }

  // Client users — redirect to their client's campaigns
  if (clientId) {
    redirect(`/clients/${clientId}/campaigns`);
  }

  // Fallback — shouldn't happen if claims are set correctly
  redirect('/login');
}
