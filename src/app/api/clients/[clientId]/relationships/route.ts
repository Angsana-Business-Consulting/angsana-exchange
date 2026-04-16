import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import type { RelationshipType, RelationshipStatus } from '@/types';

/**
 * Helper: extract user claims from request headers (set by middleware).
 */
function getUserFromHeaders(request: NextRequest) {
  return {
    uid: request.headers.get('x-user-uid') || '',
    role: request.headers.get('x-user-role') || '',
    tenantId: request.headers.get('x-user-tenant') || 'angsana',
    email: request.headers.get('x-user-email') || '',
    clientId: request.headers.get('x-user-client') || null,
    assignedClients: JSON.parse(request.headers.get('x-assigned-clients') || '[]'),
  };
}

function hasClientAccess(user: ReturnType<typeof getUserFromHeaders>, clientId: string): boolean {
  if (user.clientId) return user.clientId === clientId;
  if (user.assignedClients?.includes('*')) return true;
  return user.assignedClients?.includes(clientId) ?? false;
}

/**
 * GET /api/clients/[clientId]/relationships
 *
 * List relationships for a client with optional filters.
 * Query params:
 *   - status: 'active' | 'archived' | 'all' (default: 'active')
 *   - relationshipType: 'active-client' | 'lapsed-client' | 'prospect' | 'partner' | 'all' (default: 'all')
 *   - hasAgreement: 'true' | 'false' | 'all' (default: 'all')
 *   - search: case-insensitive substring match across companyName, brandOrDivision, service, keyContacts, notes
 *
 * Sort: companyName ASC, then addedAt DESC.
 * All roles can read. Client users are auto-scoped to their own clientId.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const user = getUserFromHeaders(request);

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this client' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = (searchParams.get('status') || 'active') as RelationshipStatus | 'all';
  const relationshipTypeFilter = (searchParams.get('relationshipType') || 'all') as RelationshipType | 'all';
  const hasAgreementFilter = searchParams.get('hasAgreement') || 'all';
  const searchQuery = (searchParams.get('search') || '').toLowerCase().trim();

  // Build Firestore query
  let query: FirebaseFirestore.Query = adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .collection('relationships');

  // Status filter — Firestore-level
  if (statusFilter !== 'all') {
    query = query.where('status', '==', statusFilter);
  }

  // Sort: companyName ASC, addedAt DESC
  query = query.orderBy('companyName', 'asc').orderBy('addedAt', 'desc');

  const snapshot = await query.get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let entries: any[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Convert Firestore timestamps to ISO strings
      addedAt: data.addedAt?.toDate?.()?.toISOString() ?? data.addedAt,
      archivedAt: data.archivedAt?.toDate?.()?.toISOString() ?? data.archivedAt ?? null,
      startDate: data.startDate?.toDate?.()?.toISOString() ?? data.startDate ?? null,
      endDate: data.endDate?.toDate?.()?.toISOString() ?? data.endDate ?? null,
    };
  });

  // Relationship type filter — client-side (keeps Firestore index simple)
  if (relationshipTypeFilter !== 'all') {
    entries = entries.filter((e: any) => e.relationshipType === relationshipTypeFilter);
  }

  // hasAgreement filter — client-side
  if (hasAgreementFilter === 'true') {
    entries = entries.filter((e: any) => e.hasAgreement === true);
  } else if (hasAgreementFilter === 'false') {
    entries = entries.filter((e: any) => !e.hasAgreement);
  }

  // Search filter — client-side (Firestore doesn't support case-insensitive substring)
  if (searchQuery) {
    entries = entries.filter((e: any) => {
      const haystack = [e.companyName, e.brandOrDivision, e.service, e.keyContacts, e.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchQuery);
    });
  }

  return NextResponse.json({ data: entries, count: entries.length });
}

/**
 * POST /api/clients/[clientId]/relationships
 * Placeholder for later step — returns 501 Not Implemented.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Not implemented. Create/edit functionality coming in a later step.' },
    { status: 501 }
  );
}
