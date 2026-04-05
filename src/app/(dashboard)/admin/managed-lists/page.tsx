import { adminDb } from '@/lib/firebase/admin';
import { getUserContext } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { ManagedListsClient } from './ManagedListsClient';
import type { ManagedListName, ManagedListItem } from '@/types';

const LIST_NAMES: ManagedListName[] = [
  'serviceTypes',
  'sectors',
  'geographies',
  'titleBands',
  'companySizes',
  'therapyAreas',
];

/**
 * Managed Lists Admin Page — /admin/managed-lists
 *
 * Server component that:
 * 1. Verifies the user is internal-admin
 * 2. Fetches all managed lists from Firestore
 * 3. Passes data to the client component for CRUD interactions
 */
export default async function ManagedListsPage() {
  const user = await getUserContext();

  // Only internal-admin can access
  if (user.claims.role !== 'internal-admin') {
    redirect('/');
  }

  const { tenantId } = user.claims;

  // Fetch all managed lists in parallel
  const results = await Promise.all(
    LIST_NAMES.map(async (listName) => {
      const doc = await adminDb
        .collection('tenants')
        .doc(tenantId)
        .collection('managedLists')
        .doc(listName)
        .get();

      const data = doc.exists ? doc.data()! : { items: [] };
      return {
        listName,
        items: (data.items || []) as ManagedListItem[],
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        updatedBy: data.updatedBy || null,
      };
    })
  );

  const initialData: Record<string, { items: ManagedListItem[]; updatedAt: string | null; updatedBy: string | null }> = {};
  for (const result of results) {
    initialData[result.listName] = {
      items: result.items,
      updatedAt: result.updatedAt,
      updatedBy: result.updatedBy,
    };
  }

  return <ManagedListsClient initialData={initialData} />;
}
