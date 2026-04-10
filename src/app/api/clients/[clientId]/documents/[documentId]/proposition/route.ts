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
 * PATCH /api/clients/[clientId]/documents/[documentId]/proposition
 * Set/clear proposition tags on a document. Internal users only.
 * Request body: { propositionRefs: ["prop-id-1", "prop-id-2"] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; documentId: string }> }
) {
  const { clientId, documentId } = await params;
  const user = getUserFromHeaders(request);

  if (!isInternal(user.role)) {
    return NextResponse.json({ error: 'Forbidden: only internal users can tag documents with propositions' }, { status: 403 });
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this client' }, { status: 403 });
  }

  const body = await request.json();
  const propositionRefs: string[] = body.propositionRefs || [];

  // Validate proposition IDs exist
  if (propositionRefs.length > 0) {
    const propsCollection = adminDb
      .collection('tenants')
      .doc(user.tenantId)
      .collection('clients')
      .doc(clientId)
      .collection('propositions');

    for (const propId of propositionRefs) {
      const propSnap = await propsCollection.doc(propId).get();
      if (!propSnap.exists) {
        return NextResponse.json({ error: `Proposition not found: ${propId}` }, { status: 400 });
      }
    }
  }

  // Update document registry entry
  const docRef = adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .collection('documents')
    .doc(documentId);

  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  await docRef.update({
    propositionRefs,
    lastModifiedBy: user.uid,
    lastModifiedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true });
}
