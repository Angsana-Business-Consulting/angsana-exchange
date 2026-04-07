// =============================================================================
// Angsana Exchange — Document Folder Provisioning API Route
// Slice 7A Step 2/3 Revision: Shared Drive Model
//
// POST /api/clients/{clientId}/documents/provision
//
// Creates a Google Shared Drive for a client with the canonical folder tree
// and stores the Shared Drive ID on the client's Firestore config document.
// One-time operation — returns 409 if already provisioned.
//
// Access: internal-admin only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { provisionClientFolders } from '@/lib/drive/provision';

/**
 * Extract user claims from request headers (set by middleware).
 * Same pattern used across all /api/clients/{clientId}/* routes.
 */
function getUserFromHeaders(request: NextRequest) {
  return {
    uid: request.headers.get('x-user-uid') || '',
    role: request.headers.get('x-user-role') || '',
    tenantId: request.headers.get('x-user-tenant') || 'angsana',
    email: request.headers.get('x-user-email') || '',
  };
}

/**
 * POST /api/clients/{clientId}/documents/provision
 *
 * Creates a Shared Drive for the client, adds the SA as Content Manager,
 * creates the canonical folder tree, and writes the Shared Drive ID back
 * to the client config document in Firestore.
 *
 * Idempotency: returns 409 if driveId or driveFolderId is already set.
 * Calling this endpoint twice will not create duplicate Shared Drives.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const user = getUserFromHeaders(request);

  // ── Auth: internal-admin only ─────────────────────────────────────────────
  if (user.role !== 'internal-admin') {
    return NextResponse.json(
      { error: 'Forbidden: only internal-admin can provision Drive folders', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // ── Read client config ────────────────────────────────────────────────────
  const configRef = adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId);

  const configDoc = await configRef.get();

  if (!configDoc.exists) {
    return NextResponse.json(
      { error: 'Client not found', code: 'CLIENT_NOT_FOUND' },
      { status: 404 }
    );
  }

  const configData = configDoc.data()!;

  // ── Idempotency guard: prevent duplicate provisioning ─────────────────────
  // Check both driveId (new Shared Drive model) and driveFolderId (legacy)
  if (configData.driveId || configData.driveFolderId) {
    return NextResponse.json(
      {
        error: 'Drive folders already provisioned for this client.',
        code: 'ALREADY_PROVISIONED',
        driveId: configData.driveId || configData.driveFolderId,
      },
      { status: 409 }
    );
  }

  // ── Read client name ──────────────────────────────────────────────────────
  const clientName = configData.name as string;
  if (!clientName) {
    return NextResponse.json(
      { error: 'Client config is missing the "name" field', code: 'INVALID_CONFIG' },
      { status: 400 }
    );
  }

  // ── Provision Shared Drive + folder tree ────────────────────────────────
  try {
    const result = await provisionClientFolders(clientId, clientName);

    // ── Write Shared Drive ID to Firestore ─────────────────────────────────
    await configRef.update({
      driveId: result.sharedDriveId,
      driveProvisionedAt: FieldValue.serverTimestamp(),
      driveProvisionedBy: user.email,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (err) {
    const driveError = err as { code?: number; message?: string; errors?: unknown[] };

    console.error(
      '[documents/provision] Drive API error during Shared Drive creation:',
      driveError.message,
      driveError.errors
    );

    return NextResponse.json(
      {
        error: 'Failed to create Shared Drive and folder tree',
        code: 'DRIVE_API_ERROR',
        detail: driveError.message,
      },
      { status: 500 }
    );
  }
}
