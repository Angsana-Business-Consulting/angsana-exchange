import Link from 'next/link';
import { adminDb } from '@/lib/firebase/admin';
import { getUserContext, isInternalRole } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

/**
 * My Clients — /my-clients
 *
 * Landing page for internal-user and internal-admin.
 * Shows the user's assigned clients with campaign counts.
 */
export default async function MyClientsPage() {
  const user = await getUserContext();

  // Only internal users should see this page
  if (!isInternalRole(user.claims.role)) {
    redirect('/');
  }

  const { tenantId, assignedClients } = user.claims;
  const isAdmin = assignedClients?.includes('*');

  // Determine which clients to show
  let clientIds: string[] = [];
  if (isAdmin) {
    // Fetch all clients from Firestore
    const snapshot = await adminDb
      .collection('tenants')
      .doc(tenantId)
      .collection('clients')
      .get();
    clientIds = snapshot.docs.map((doc) => doc.id);
  } else {
    clientIds = assignedClients || [];
  }

  // Fetch client configs and campaign counts
  const clients = await Promise.all(
    clientIds.map(async (clientId) => {
      const clientDoc = await adminDb
        .collection('tenants')
        .doc(tenantId)
        .collection('clients')
        .doc(clientId)
        .get();

      const campaignSnapshot = await adminDb
        .collection('tenants')
        .doc(tenantId)
        .collection('clients')
        .doc(clientId)
        .collection('campaigns')
        .get();

      const data = clientDoc.data();
      const activeCampaigns = campaignSnapshot.docs.filter(
        (d) => d.data().status === 'active'
      ).length;

      return {
        id: clientId,
        name: data?.name || clientId,
        tier: data?.tier || 'standard',
        totalCampaigns: campaignSnapshot.size,
        activeCampaigns,
      };
    })
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">
          My Clients
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {clients.length} client{clients.length !== 1 ? 's' : ''} assigned
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Link
            key={client.id}
            href={`/clients/${client.id}/campaigns`}
            className="group rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
          >
            <h3 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
              {client.name}
            </h3>
            <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[var(--muted)]">
              {client.tier}
            </span>
            <div className="mt-4 flex gap-6 text-sm">
              <div>
                <span className="text-2xl font-bold text-[var(--primary)]">
                  {client.activeCampaigns}
                </span>
                <p className="text-[var(--muted)]">Active</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-[var(--foreground)]">
                  {client.totalCampaigns}
                </span>
                <p className="text-[var(--muted)]">Total</p>
              </div>
            </div>
          </Link>
        ))}

        {clients.length === 0 && (
          <p className="col-span-full text-sm text-[var(--muted)]">
            No clients assigned yet.
          </p>
        )}
      </div>
    </div>
  );
}
