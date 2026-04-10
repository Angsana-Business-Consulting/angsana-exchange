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
 * PATCH /api/clients/[clientId]/propositions/[id]
 * Update a proposition. Internal users only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; id: string }> }
) {
  const { clientId, id } = await params;
  const user = getUserFromHeaders(request);

  if (!isInternal(user.role)) {
    return NextResponse.json({ error: 'Forbidden: only internal users can update propositions' }, { status: 403 });
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this client' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Validate fields if present
    if (body.name !== undefined && body.name.length > 80) {
      return NextResponse.json({ error: 'Proposition name must be 80 characters or less' }, { status: 400 });
    }
    if (body.description !== undefined && body.description.length > 280) {
      return NextResponse.json({ error: 'Description must be 280 characters or less' }, { status: 400 });
    }

    const docRef = adminDb
      .collection('tenants')
      .doc(user.tenantId)
      .collection('clients')
      .doc(clientId)
      .collection('propositions')
      .doc(id);

    const existing = await docRef.get();
    if (!existing.exists) {
      return NextResponse.json({ error: 'Proposition not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      lastUpdatedBy: user.uid,
      lastUpdatedAt: FieldValue.serverTimestamp(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.category !== undefined) updateData.category = body.category;
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.status !== undefined) updateData.status = body.status;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    await docRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Proposition PATCH error:', err);
    return NextResponse.json(
      { error: `Internal server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[clientId]/propositions/[id]
 * Soft-delete (set status: inactive). Internal users only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; id: string }> }
) {
  const { clientId, id } = await params;
  const user = getUserFromHeaders(request);

  if (!isInternal(user.role)) {
    return NextResponse.json({ error: 'Forbidden: only internal users can delete propositions' }, { status: 403 });
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this client' }, { status: 403 });
  }

  try {
    const docRef = adminDb
      .collection('tenants')
      .doc(user.tenantId)
      .collection('clients')
      .doc(clientId)
      .collection('propositions')
      .doc(id);

    const existing = await docRef.get();
    if (!existing.exists) {
      return NextResponse.json({ error: 'Proposition not found' }, { status: 404 });
    }

    await docRef.update({
      status: 'inactive',
      lastUpdatedBy: user.uid,
      lastUpdatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Proposition DELETE error:', err);
    return NextResponse.json(
      { error: `Internal server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
