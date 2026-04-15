import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import type { ExclusionScope, ExclusionStatus } from '@/types';

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
 * GET /api/clients/[clientId]/exclusions
 *
 * List exclusions for a client with optional filters.
 * Query params:
 *   - status: 'active' | 'removed' | 'all' (default: 'active')
 *   - scope: 'company-wide' | 'company-scoped' | 'contact-only' | 'all' (default: 'all')
 *   - reason: specific reason value, 'no-reason', or 'all' (default: 'all')
 *   - search: case-insensitive substring match across companyName, contactName, notes
 *
 * Sort: companyName ASC, then addedAt DESC within same company.
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
  const statusFilter = (searchParams.get('status') || 'active') as ExclusionStatus | 'all';
  const scopeFilter = (searchParams.get('scope') || 'all') as ExclusionScope | 'all';
  const reasonFilter = searchParams.get('reason') || 'all';
  const searchQuery = (searchParams.get('search') || '').toLowerCase().trim();

  // Build Firestore query
  let query: FirebaseFirestore.Query = adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .collection('exclusions');

  // Status filter — Firestore-level
  if (statusFilter !== 'all') {
    query = query.where('status', '==', statusFilter);
  }

  // Scope filter — Firestore-level (only if also filtering by status, to match composite index)
  if (scopeFilter !== 'all') {
    query = query.where('scope', '==', scopeFilter);
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
      removedAt: data.removedAt?.toDate?.()?.toISOString() ?? data.removedAt ?? null,
    };
  });

  // Reason filter — client-side (Firestore can't filter on optional field efficiently)
  if (reasonFilter !== 'all') {
    if (reasonFilter === 'no-reason') {
      entries = entries.filter((e: any) => !e.reason);
    } else {
      entries = entries.filter((e: any) => e.reason === reasonFilter);
    }
  }

  // Search filter — client-side (Firestore doesn't support case-insensitive substring)
  // Searches companyName and contactName only (not notes — short notes like "Fully closed"
  // cause false positives when searching for substrings like "se")
  if (searchQuery) {
    entries = entries.filter((e: any) => {
      const haystack = [e.companyName, e.contactName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchQuery);
    });
  }

  return NextResponse.json({ data: entries, count: entries.length });
}

/**
 * POST /api/clients/[clientId]/exclusions
 * Placeholder for Step 2 — returns 501 Not Implemented.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Not implemented. Create/edit functionality coming in Step 2.' },
    { status: 501 }
  );
}
