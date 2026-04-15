import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { ManagedListName, ManagedListItem } from '@/types';

const VALID_LIST_NAMES: ManagedListName[] = [
  'serviceTypes',
  'sectors',
  'geographies',
  'titleBands',
  'companySizes',
  'therapyAreas',
  'documentFolders',
  'propositionCategories',
  'messagingTypes',
  'buyingProcessTypes',
  'exclusionReasons',
];

/**
 * Helper: extract user claims from request headers (set by middleware).
 */
function getUserFromHeaders(request: NextRequest) {
  return {
    role: request.headers.get('x-user-role') || '',
    tenantId: request.headers.get('x-user-tenant') || 'angsana',
    email: request.headers.get('x-user-email') || '',
  };
}

/**
 * GET /api/managed-lists/[listName]
 * Returns the managed list document. Accessible to all authenticated users.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listName: string }> }
) {
  const { listName } = await params;
  const { tenantId } = getUserFromHeaders(request);

  if (!VALID_LIST_NAMES.includes(listName as ManagedListName)) {
    return NextResponse.json({ error: 'Invalid list name' }, { status: 400 });
  }

  const doc = await adminDb
    .collection('tenants')
    .doc(tenantId)
    .collection('managedLists')
    .doc(listName)
    .get();

  if (!doc.exists) {
    return NextResponse.json({ items: [], updatedAt: null });
  }

  const data = doc.data()!;
  return NextResponse.json({
    items: data.items || [],
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
    updatedBy: data.updatedBy || null,
  });
}

/**
 * PUT /api/managed-lists/[listName]
 * Updates the entire items array for a managed list.
 * Only accessible to internal-admin.
 *
 * Body: { items: ManagedListItem[] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ listName: string }> }
) {
  const { listName } = await params;
  const { role, tenantId, email } = getUserFromHeaders(request);

  if (role !== 'internal-admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!VALID_LIST_NAMES.includes(listName as ManagedListName)) {
    return NextResponse.json({ error: 'Invalid list name' }, { status: 400 });
  }

  const body = await request.json();
  const items: ManagedListItem[] = body.items;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
  }

  // Validate each item
  for (const item of items) {
    if (!item.id || !item.label || typeof item.active !== 'boolean') {
      return NextResponse.json(
        { error: `Invalid item: ${JSON.stringify(item)}` },
        { status: 400 }
      );
    }
  }

  await adminDb
    .collection('tenants')
    .doc(tenantId)
    .collection('managedLists')
    .doc(listName)
    .set({
      items,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: email,
    });

  return NextResponse.json({ success: true });
}
