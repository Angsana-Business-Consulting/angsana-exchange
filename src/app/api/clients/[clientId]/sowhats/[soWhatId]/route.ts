import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

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

function isInternal(role: string): boolean {
  return role === 'internal-admin' || role === 'internal-user';
}

/**
 * PUT /api/clients/[clientId]/sowhats/[soWhatId]
 * Updates So What content fields.
 * Internal users: can edit any So What in any status.
 * Client-approver: can edit only own drafts.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; soWhatId: string }> }
) {
  const { clientId, soWhatId } = await params;
  const user = getUserFromHeaders(request);

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this client' }, { status: 403 });
  }

  const docRef = adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .collection('soWhats')
    .doc(soWhatId);

  const doc = await docRef.get();
  if (!doc.exists) {
    return NextResponse.json({ error: 'So What not found' }, { status: 404 });
  }

  const currentData = doc.data()!;

  // Permission check
  if (isInternal(user.role)) {
    // Internal users can edit any So What
  } else if (user.role === 'client-approver') {
    // Client-approver can only edit own drafts
    if (currentData.createdBy !== user.email) {
      return NextResponse.json({ error: 'Forbidden: you can only edit So Whats you created' }, { status: 403 });
    }
    if (currentData.status !== 'draft') {
      return NextResponse.json({ error: 'Forbidden: you can only edit draft So Whats' }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();

  // Validate lengths
  if (body.headline && body.headline.length > 80) {
    return NextResponse.json({ error: 'Headline must be 80 characters or less' }, { status: 400 });
  }
  if (body.emailVersion && body.emailVersion.length > 200) {
    return NextResponse.json({ error: 'Email version must be 200 characters or less' }, { status: 400 });
  }
  if (body.supportingEvidence && body.supportingEvidence.length > 300) {
    return NextResponse.json({ error: 'Supporting evidence must be 300 characters or less' }, { status: 400 });
  }
  if (body.sourceRef && body.sourceRef.length > 200) {
    return NextResponse.json({ error: 'Source reference must be 200 characters or less' }, { status: 400 });
  }

  // Validate orientation tags if provided
  if (body.orientationTags) {
    const validOrientations = ['internal-facing', 'external-facing', 'both'];
    for (const tag of body.orientationTags) {
      if (!validOrientations.includes(tag)) {
        return NextResponse.json({ error: `Invalid orientation tag: ${tag}` }, { status: 400 });
      }
    }
  }

  // Build update — only content fields (status is changed via POST)
  const allowedFields = [
    'headline', 'emailVersion', 'supportingEvidence',
    'audienceTags', 'orientationTags', 'sourceRef',
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  updateData.updatedBy = user.email;
  updateData.updatedDate = FieldValue.serverTimestamp();

  await docRef.update(updateData);

  return NextResponse.json({ success: true });
}

/**
 * POST /api/clients/[clientId]/sowhats/[soWhatId]
 * Handles status changes. Body: { action: 'approve' | 'retire' | 'revert-to-draft' }
 * Only internal users can change status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; soWhatId: string }> }
) {
  const { clientId, soWhatId } = await params;
  const user = getUserFromHeaders(request);

  if (!isInternal(user.role)) {
    return NextResponse.json({ error: 'Forbidden: only internal users can change So What status' }, { status: 403 });
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this client' }, { status: 403 });
  }

  const docRef = adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .collection('soWhats')
    .doc(soWhatId);

  const doc = await docRef.get();
  if (!doc.exists) {
    return NextResponse.json({ error: 'So What not found' }, { status: 404 });
  }

  const currentData = doc.data()!;
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case 'approve': {
      if (currentData.status !== 'draft') {
        return NextResponse.json({ error: 'Can only approve a draft So What' }, { status: 400 });
      }
      await docRef.update({
        status: 'approved',
        updatedBy: user.email,
        updatedDate: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, newStatus: 'approved' });
    }

    case 'retire': {
      if (currentData.status !== 'approved') {
        return NextResponse.json({ error: 'Can only retire an approved So What' }, { status: 400 });
      }
      await docRef.update({
        status: 'retired',
        updatedBy: user.email,
        updatedDate: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, newStatus: 'retired' });
    }

    case 'revert-to-draft': {
      if (currentData.status === 'draft') {
        return NextResponse.json({ error: 'Already in draft status' }, { status: 400 });
      }
      await docRef.update({
        status: 'draft',
        updatedBy: user.email,
        updatedDate: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, newStatus: 'draft' });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}. Valid: approve, retire, revert-to-draft` },
        { status: 400 }
      );
  }
}

/**
 * DELETE /api/clients/[clientId]/sowhats/[soWhatId]
 * Only internal-admin can delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; soWhatId: string }> }
) {
  const { clientId, soWhatId } = await params;
  const user = getUserFromHeaders(request);

  if (user.role !== 'internal-admin') {
    return NextResponse.json({ error: 'Forbidden: only internal-admin can delete So Whats' }, { status: 403 });
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this client' }, { status: 403 });
  }

  const docRef = adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .collection('soWhats')
    .doc(soWhatId);

  const doc = await docRef.get();
  if (!doc.exists) {
    return NextResponse.json({ error: 'So What not found' }, { status: 404 });
  }

  await docRef.delete();
  return NextResponse.json({ success: true });
}
