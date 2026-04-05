import { adminDb } from '@/lib/firebase/admin';
import { getUserContext, hasClientAccess, isInternalRole } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { CampaignForm } from '../../CampaignForm';
import type { Campaign, ManagedListItem } from '@/types';

/**
 * Campaign Edit Page — /clients/[clientId]/campaigns/[campaignId]/edit
 *
 * Full page form pre-populated with current campaign values.
 * Only internal-user and internal-admin can access.
 * Completed campaigns cannot be edited.
 */
export default async function CampaignEditPage({
  params,
}: {
  params: Promise<{ clientId: string; campaignId: string }>;
}) {
  const { clientId, campaignId } = await params;
  const user = await getUserContext();
  const { tenantId } = user.claims;

  // Only internal users can edit
  if (!isInternalRole(user.claims.role)) {
    redirect(`/clients/${clientId}/campaigns/${campaignId}`);
  }

  if (!hasClientAccess(user.claims, clientId)) {
    redirect('/');
  }

  // Fetch campaign
  const campaignDoc = await adminDb
    .collection('tenants')
    .doc(tenantId)
    .collection('clients')
    .doc(clientId)
    .collection('campaigns')
    .doc(campaignId)
    .get();

  if (!campaignDoc.exists) {
    redirect(`/clients/${clientId}/campaigns`);
  }

  const data = campaignDoc.data()!;

  // Cannot edit completed campaigns
  if (data.status === 'completed') {
    redirect(`/clients/${clientId}/campaigns/${campaignId}`);
  }

  const campaign: Campaign = {
    id: campaignDoc.id,
    campaignName: data.campaignName || '',
    status: data.status || 'draft',
    serviceType: data.serviceType || '',
    serviceTypeId: data.serviceTypeId || '',
    owner: data.owner || '',
    startDate: data.startDate?.toDate?.()?.toISOString() || '',
    campaignSummary: data.campaignSummary || '',
    targetGeographies: data.targetGeographies || [],
    targetSectors: data.targetSectors || [],
    targetTitles: data.targetTitles || [],
    companySize: data.companySize || '',
    valueProposition: data.valueProposition || '',
    painPoints: data.painPoints || [],
    selectedSoWhats: data.selectedSoWhats || [],
    statusHistory: data.statusHistory || [],
    pauseReason: data.pauseReason || '',
    createdBy: data.createdBy || '',
    createdAt: data.createdAt?.toDate?.()?.toISOString() || '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || '',
  };

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
      mode="edit"
      clientId={clientId}
      clientName={clientName}
      managedLists={managedLists}
      initialData={campaign}
    />
  );
}
