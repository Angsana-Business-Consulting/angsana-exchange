import Link from 'next/link';
import { adminDb } from '@/lib/firebase/admin';
import { getUserContext } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

/**
 * Portfolio — /portfolio
 *
 * Landing page for internal-admin.
 * Cross-client dashboard showing all clients with key metrics.
 */
export default async function PortfolioPage() {
  const user = await getUserContext();

  // Only admin can see the portfolio
  if (user.claims.role !== 'internal-admin') {
    redirect('/');
  }

  const { tenantId } = user.claims;

  // Fetch all clients
  const clientsSnapshot = await adminDb
    .collection('tenants')
    .doc(tenantId)
    .collection('clients')
    .get();

  const clients = await Promise.all(
    clientsSnapshot.docs.map(async (doc) => {
      const data = doc.data();

      const campaignSnapshot = await adminDb
        .collection('tenants')
        .doc(tenantId)
        .collection('clients')
        .doc(doc.id)
        .collection('campaigns')
        .get();

      const activeCampaigns = campaignSnapshot.docs.filter(
        (d) => d.data().status === 'active'
      ).length;

      const draftCampaigns = campaignSnapshot.docs.filter(
        (d) => d.data().status === 'draft'
      ).length;

      return {
        id: doc.id,
        name: data.name || doc.id,
        tier: data.tier || 'standard',
        totalCampaigns: campaignSnapshot.size,
        activeCampaigns,
        draftCampaigns,
      };
    })
  );

  const totalActive = clients.reduce((sum, c) => sum + c.activeCampaigns, 0);
  const totalCampaigns = clients.reduce((sum, c) => sum + c.totalCampaigns, 0);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">
          Portfolio
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Cross-client overview — {clients.length} clients
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-[var(--muted)]">Total Clients</p>
          <p className="mt-1 text-3xl font-bold text-[var(--primary)]">
            {clients.length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-[var(--muted)]">Active Campaigns</p>
          <p className="mt-1 text-3xl font-bold text-[var(--accent-green)]">
            {totalActive}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-[var(--muted)]">Total Campaigns</p>
          <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">
            {totalCampaigns}
          </p>
        </div>
      </div>

      {/* Client list */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Tier
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Active
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Draft
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((client) => (
              <tr
                key={client.id}
                className="transition-colors hover:bg-gray-50"
              >
                <td className="px-6 py-4">
                  <Link
                    href={`/clients/${client.id}/campaigns`}
                    className="text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    {client.name}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[var(--muted)]">
                    {client.tier}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-[var(--accent-green)]">
                  {client.activeCampaigns}
                </td>
                <td className="px-6 py-4 text-sm text-[var(--muted)]">
                  {client.draftCampaigns}
                </td>
                <td className="px-6 py-4 text-sm text-[var(--foreground)]">
                  {client.totalCampaigns}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
