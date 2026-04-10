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

function isInternalOrApprover(role: string): boolean {
  return role === 'internal-admin' || role === 'internal-user' || role === 'client-approver';
}

function isInternal(role: string): boolean {
  return role === 'internal-admin' || role === 'internal-user';
}

/**
 * PATCH /api/clients/[clientId]/prospecting-profile/icp
 * Update the ICP section. Internal users and client-approver.
 * When client-approver saves, triggers auto-action for AM.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const user = getUserFromHeaders(request);

  if (!isInternalOrApprover(user.role)) {
    return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden: no access to this client' }, { status: 403 });
  }

  try {
    const body = await request.json();

    const docRef = adminDb
      .collection('tenants')
      .doc(user.tenantId)
      .collection('clients')
      .doc(clientId)
      .collection('config')
      .doc('prospectingProfile');

    // Build the ICP object as a properly nested structure.
    // IMPORTANT: set() with merge treats dot-notation keys as literal field names,
    // NOT nested paths. We must use a nested object structure.
    const icpUpdate: Record<string, unknown> = {};
    if (body.industries !== undefined) icpUpdate.industries = body.industries;
    if (body.companySizing !== undefined) icpUpdate.companySizing = body.companySizing;
    if (body.titles !== undefined) icpUpdate.titles = body.titles;
    if (body.seniority !== undefined) icpUpdate.seniority = body.seniority;
    if (body.buyingProcess !== undefined) icpUpdate.buyingProcess = body.buyingProcess;
    if (body.geographies !== undefined) icpUpdate.geographies = body.geographies;
    if (body.exclusions !== undefined) icpUpdate.exclusions = body.exclusions;
    icpUpdate.lastUpdatedBy = user.uid;
    icpUpdate.lastUpdatedAt = FieldValue.serverTimestamp();

    await docRef.set(
      {
        icp: icpUpdate,
        lastUpdatedBy: user.uid,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // If client-approver, create auto-action for assigned AM
    if (!isInternal(user.role)) {
      try {
        await adminDb
          .collection('tenants')
          .doc(user.tenantId)
          .collection('clients')
          .doc(clientId)
          .collection('actions')
          .add({
            title: 'Client updated ICP — review changes',
            description: `${user.email} updated the Ideal Client Profile. Review the changes in the Prospecting Profile.`,
            assignedTo: '', // Will be filled by AM assignment logic
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
            status: 'open',
            priority: 'medium',
            source: { type: 'manual' },
            relatedCampaign: '',
            createdBy: user.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
      } catch (err) {
        console.error('Failed to create auto-action for ICP update:', err);
        // Non-blocking — don't fail the ICP save
      }
    }

    return NextResponse.json({ success: true, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('ICP PATCH error:', err);
    return NextResponse.json(
      { error: `Internal server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
