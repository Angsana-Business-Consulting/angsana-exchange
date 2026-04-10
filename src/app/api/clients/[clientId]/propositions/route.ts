import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

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

function isInternal(role: string): boolean {
  return role === 'internal-admin' || role === 'internal-user';
}

/**
 * GET /api/clients/[clientId]/propositions
 * List all propositions for the client. Supports ?status=active filter.
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
  const statusFilter = searchParams.get('status');

  let query = adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .collection('propositions')
    .orderBy('sortOrder', 'asc');

  if (statusFilter) {
    query = query.where('status', '==', statusFilter);
  }

  const snap = await query.get();
  const propositions = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name || '',
      category: d.category || '',
      description: d.description || '',
      status: d.status || 'active',
      sortOrder: d.sortOrder ?? 0,
      createdBy: d.createdBy || '',
      createdAt: d.createdAt?.toDate?.()?.toISOString() || '',
      lastUpdatedBy: d.lastUpdatedBy || '',
      lastUpdatedAt: d.lastUpdatedAt?.toDate?.()?.toISOString() || '',
    };
  });

  return NextResponse.json({ propositions });
}

/**
 * POST /api/clients/[clientId]/propositions
 * Create a new proposition. Internal users only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const user = getUserFromHeaders(request);

  if (!isInternal(user.role)) {
    return NextResponse.json({ error: 'Forbidden: only internal users can create propositions' }, { status: 403 });
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this client' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }
    if (body.name.length > 80) {
      return NextResponse.json({ error: 'Proposition name must be 80 characters or less' }, { status: 400 });
    }
    if (body.description && body.description.length > 280) {
      return NextResponse.json({ error: 'Description must be 280 characters or less' }, { status: 400 });
    }

    const propositionData = {
      name: body.name.trim(),
      category: body.category || '',
      description: body.description?.trim() || '',
      status: 'active',
      sortOrder: body.sortOrder ?? 0,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      lastUpdatedBy: user.uid,
      lastUpdatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb
      .collection('tenants')
      .doc(user.tenantId)
      .collection('clients')
      .doc(clientId)
      .collection('propositions')
      .add(propositionData);

    return NextResponse.json({ id: docRef.id, success: true }, { status: 201 });
  } catch (err) {
    console.error('Proposition POST error:', err);
    return NextResponse.json(
      { error: `Internal server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
