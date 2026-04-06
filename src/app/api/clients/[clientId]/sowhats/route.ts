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

function canCreate(role: string): boolean {
  return isInternal(role) || role === 'client-approver';
}

/**
 * POST /api/clients/[clientId]/sowhats
 * Creates a new So What in draft status.
 * Internal users and client-approvers can create.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const user = getUserFromHeaders(request);

  // Permission check
  if (!canCreate(user.role)) {
    return NextResponse.json({ error: 'Forbidden: only internal users and client-approvers can create So Whats' }, { status: 403 });
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this client' }, { status: 403 });
  }

  const body = await request.json();

  // Validate required fields
  const requiredFields = ['headline', 'emailVersion', 'supportingEvidence', 'audienceTags', 'orientationTags'];
  for (const field of requiredFields) {
    if (!body[field] || (Array.isArray(body[field]) && body[field].length === 0)) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  // Validate lengths
  if (body.headline.length > 80) {
    return NextResponse.json({ error: 'Headline must be 80 characters or less' }, { status: 400 });
  }
  if (body.emailVersion.length > 200) {
    return NextResponse.json({ error: 'Email version must be 200 characters or less' }, { status: 400 });
  }
  if (body.supportingEvidence.length > 300) {
    return NextResponse.json({ error: 'Supporting evidence must be 300 characters or less' }, { status: 400 });
  }
  if (body.sourceRef && body.sourceRef.length > 200) {
    return NextResponse.json({ error: 'Source reference must be 200 characters or less' }, { status: 400 });
  }

  // Validate orientation tags
  const validOrientations = ['internal-facing', 'external-facing', 'both'];
  for (const tag of body.orientationTags) {
    if (!validOrientations.includes(tag)) {
      return NextResponse.json({ error: `Invalid orientation tag: ${tag}` }, { status: 400 });
    }
  }

  const soWhatData = {
    headline: body.headline,
    emailVersion: body.emailVersion,
    supportingEvidence: body.supportingEvidence,
    audienceTags: body.audienceTags,
    orientationTags: body.orientationTags,
    sourceRef: body.sourceRef || '',
    status: 'draft', // Always draft on create
    createdBy: user.email,
    createdDate: FieldValue.serverTimestamp(),
    updatedBy: user.email,
    updatedDate: FieldValue.serverTimestamp(),
  };

  const docRef = await adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .collection('soWhats')
    .add(soWhatData);

  return NextResponse.json({ id: docRef.id, success: true }, { status: 201 });
}
