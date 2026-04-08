import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentFolderItem } from '@/types';

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
 * GET /api/managed-lists/document-folders
 * Returns the document folders managed list. Accessible to all authenticated users.
 */
export async function GET(request: NextRequest) {
  const { tenantId } = getUserFromHeaders(request);

  const doc = await adminDb
    .collection('tenants')
    .doc(tenantId)
    .collection('managedLists')
    .doc('documentFolders')
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
 * PUT /api/managed-lists/document-folders
 * Updates the document folders managed list.
 * Only accessible to internal-admin.
 *
 * Guardrails:
 * - folderCategory is immutable after creation (cannot be changed on existing items)
 * - visibility cannot be changed once any client has files registered under that folderCategory
 *   (this check is deferred to a future slice — for now, a warning comment)
 * - isContainer flag is validated
 *
 * Body: { items: DocumentFolderItem[] }
 */
export async function PUT(request: NextRequest) {
  const { role, tenantId, email } = getUserFromHeaders(request);

  if (role !== 'internal-admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const items: DocumentFolderItem[] = body.items;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
  }

  // Validate each item
  for (const item of items) {
    if (!item.folderCategory || !item.name || typeof item.active !== 'boolean') {
      return NextResponse.json(
        { error: `Invalid item: missing required fields. folderCategory, name, and active are required. Got: ${JSON.stringify(item)}` },
        { status: 400 }
      );
    }
    if (!['client-visible', 'internal-only'].includes(item.visibility) && !item.isContainer) {
      return NextResponse.json(
        { error: `Invalid visibility "${item.visibility}" for folder "${item.folderCategory}". Must be "client-visible" or "internal-only".` },
        { status: 400 }
      );
    }
    if (typeof item.sortOrder !== 'number') {
      return NextResponse.json(
        { error: `sortOrder must be a number for folder "${item.folderCategory}".` },
        { status: 400 }
      );
    }
  }

  // Check for duplicate folderCategory keys
  const categories = items.map((i) => i.folderCategory);
  const duplicates = categories.filter((c, idx) => categories.indexOf(c) !== idx);
  if (duplicates.length > 0) {
    return NextResponse.json(
      { error: `Duplicate folderCategory keys: ${duplicates.join(', ')}` },
      { status: 400 }
    );
  }

  // Guardrail: folderCategory is immutable — cannot remove existing categories
  const existingDoc = await adminDb
    .collection('tenants')
    .doc(tenantId)
    .collection('managedLists')
    .doc('documentFolders')
    .get();

  if (existingDoc.exists) {
    const existingItems = (existingDoc.data()?.items || []) as DocumentFolderItem[];
    const existingCategories = existingItems.map((i) => i.folderCategory);
    const newCategories = items.map((i) => i.folderCategory);

    // Cannot remove existing categories (they may be referenced by registry entries)
    const removed = existingCategories.filter((c) => !newCategories.includes(c));
    if (removed.length > 0) {
      return NextResponse.json(
        { error: `Cannot remove existing folderCategory keys (they may be referenced by registry entries): ${removed.join(', ')}. Deactivate them instead.` },
        { status: 400 }
      );
    }

    // Cannot change folderCategory key of existing items (compare by position is not reliable,
    // so we just verify all existing categories are still present — which we already did above)
  }

  // TODO (future): Check if visibility changed for any folderCategory that has existing
  // registry entries. Block the change if files exist. For now, this is enforced by
  // the admin UI showing a warning, not by the API.

  await adminDb
    .collection('tenants')
    .doc(tenantId)
    .collection('managedLists')
    .doc('documentFolders')
    .set({
      items,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: email,
    });

  return NextResponse.json({ success: true });
}
