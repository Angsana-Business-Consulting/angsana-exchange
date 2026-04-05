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

  const clientData = clientDoc.exists ? clientDoc.data()! : {};
  const clientName = (clientData.name as string) || clientId;

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

  // Build therapy area config from client capabilities
  const capabilities: string[] = clientData.capabilities || [];
  const hasTherapyAreas = capabilities.includes('therapyAreas');
  let therapyAreaConfig: { enabled: boolean; activeAreas: ManagedListItem[]; conflictedAreas: string[] } | undefined;

  if (hasTherapyAreas) {
    // Fetch the therapy areas managed list for labels
    const therapyAreasDoc = await adminDb
      .collection('tenants')
      .doc(tenantId)
      .collection('managedLists')
      .doc('therapyAreas')
      .get();
    const allTherapyAreas: ManagedListItem[] = therapyAreasDoc.exists
      ? (therapyAreasDoc.data()!.items as ManagedListItem[]) || []
      : [];

    // Client's active therapy area IDs
    const clientActiveIds: string[] = clientData.therapyAreas || [];
    // Filter the managed list to only the client's active areas
    const activeAreas = allTherapyAreas.filter((ta) => clientActiveIds.includes(ta.id));

    // Get conflicted area labels
    const conflictedIds: string[] = clientData.conflictedTherapyAreas || [];
    const conflictedLabels = conflictedIds.map((id) => {
      const item = allTherapyAreas.find((ta) => ta.id === id);
      return item ? item.label : id;
    });

    therapyAreaConfig = {
      enabled: true,
      activeAreas,
      conflictedAreas: conflictedLabels,
    };
  }

  return (
    <CampaignForm
      mode="create"
      clientId={clientId}
      clientName={clientName}
      managedLists={managedLists}
      therapyAreaConfig={therapyAreaConfig}
    />
  );
}
