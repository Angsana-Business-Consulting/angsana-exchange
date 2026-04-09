// =============================================================================
// Angsana Exchange — Document Campaign Link API Route
// Slice 7A Step 4, Step 15: Link/unlink a document to a campaign
//
// PATCH /api/clients/{clientId}/documents/{documentId}/campaign
//
// Updates the campaignRef on a Firestore document registry entry.
// This is a Firestore-only mutation — no Drive API call needed since
// campaign associations are purely a Firestore concern.
//
// Access: internal-admin and internal-user only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromHeaders, hasClientAccess, isInternal } from '@/lib/api/middleware/user-context';

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * PATCH /api/clients/{clientId}/documents/{documentId}/campaign
 *
 * Request body (JSON):
 *   - campaignRef: string | null — campaign ID to link, or null to unlink
 *
 * Returns the updated document metadata.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; documentId: string }> }
) {
  const { clientId, documentId } = await params;
  const user = getUserFromHeaders(request);

  // ── Auth: internal roles only ───────────────────────────────────────────
  if (!isInternal(user.role)) {
    return NextResponse.json(
      { error: 'Forbidden: only internal users can update campaign links', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json(
      { error: 'Forbidden: no access to this client', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // ── Parse request body ──────────────────────────────────────────────────
  let body: { campaignRef?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  }

  // campaignRef must be explicitly provided (can be string or null)
  if (!('campaignRef' in body)) {
    return NextResponse.json(
      { error: 'Missing required field: campaignRef (use null to unlink)', code: 'MISSING_FIELD' },
      { status: 400 }
    );
  }

  const campaignRef = body.campaignRef;

  // Validate campaignRef is string or null
  if (campaignRef !== null && (typeof campaignRef !== 'string' || campaignRef.trim() === '')) {
    return NextResponse.json(
      { error: 'campaignRef must be a non-empty string or null', code: 'INVALID_FIELD' },
      { status: 400 }
    );
  }

  // ── Load registry entry ─────────────────────────────────────────────────
  const docRef = adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .collection('documents')
    .doc(documentId);

  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return NextResponse.json(
      { error: 'Document not found in registry', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const docData = docSnap.data()!;

  if (docData.status !== 'active') {
    return NextResponse.json(
      { error: 'Cannot update campaign link on a deleted document', code: 'DOCUMENT_DELETED' },
      { status: 400 }
    );
  }

  const previousCampaignRef = docData.campaignRef || null;

  // ── If campaign is being linked, validate it exists ─────────────────────
  if (campaignRef) {
    const campaignDoc = await adminDb
      .collection('tenants')
      .doc(user.tenantId)
      .collection('clients')
      .doc(clientId)
      .collection('campaigns')
      .doc(campaignRef)
      .get();

    if (!campaignDoc.exists) {
      return NextResponse.json(
        { error: `Campaign "${campaignRef}" not found for this client`, code: 'CAMPAIGN_NOT_FOUND' },
        { status: 404 }
      );
    }
  }

  // ── Firestore update ────────────────────────────────────────────────────
  const now = new Date().toISOString();

  try {
    await docRef.update({
      campaignRef: campaignRef || null,
      lastModifiedAt: now,
      lastModifiedBy: user.uid,
    });

    console.log(
      `[documents/campaign] Document ${documentId} campaign link: ` +
      `${previousCampaignRef || '(none)'} → ${campaignRef || '(none)'}`
    );
  } catch (err) {
    console.error('[documents/campaign] Firestore update failed:', err);
    return NextResponse.json(
      { error: 'Failed to update campaign link', code: 'FIRESTORE_ERROR' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      documentId,
      name: docData.name,
      previousCampaignRef,
      campaignRef: campaignRef || null,
      lastModifiedAt: now,
      lastModifiedBy: user.uid,
    },
  });
}
