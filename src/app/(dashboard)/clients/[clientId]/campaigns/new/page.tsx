import { adminDb } from '@/lib/firebase/admin';
import { getUserContext, hasClientAccess, isInternalRole } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { CampaignForm } from '../CampaignForm';
import type { ManagedListItem } from '@/types';

/**
 * Campaign Create Page — /clients/[clientId]/campaigns/new
 *
 * Full page form for creating a new campaign.
 * Only internal-user and internal-admin can access.
 */
export default async function CampaignNewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const user = await getUserContext();
  const { tenantId } = user.claims;

  // Only internal users can create campaigns
  if (!isInternalRole(user.claims.role)) {
    redirect(`/clients/${clientId}/campaigns`);
  }

  if (!hasClientAccess(user.claims, clientId)) {
    redirect('/');
  }

  // Fetch client name
  const clientDoc = await adminDb
    .collection('tenants')
    .doc(tenantId)
    .collection('clients')
    .doc(clientId)
    .get();

  const clientName = clientDoc.exists
    ? (clientDoc.data()?.name as string) || clientId
    : clientId;

  // Fetch managed lists
  const listNames = ['serviceTypes', 'geographies', 'sectors', 'titleBands', 'companySizes'];
  const listDocs = await Promise.all(
    listNames.map((name) =>
      adminDb
        .collection('tenants')
        .doc(tenantId)
        .collection('managedLists')
        .doc(name)
        .get()
    )
  );

  const managedLists: Record<string, ManagedListItem[]> = {};
  listNames.forEach((name, i) => {
    managedLists[name] = listDocs[i].exists
      ? (listDocs[i].data()!.items as ManagedListItem[]) || []
      : [];
  });

  return (
    <CampaignForm
      mode="create"
      clientId={clientId}
      clientName={clientName}
      managedLists={managedLists}
    />
  );
}
