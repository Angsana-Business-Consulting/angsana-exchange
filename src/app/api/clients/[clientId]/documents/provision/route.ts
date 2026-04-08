// =============================================================================
// Angsana Exchange — Document Folder Provisioning API Route (State Machine)
// Slice 7A Step 2/3 Revision: Shared Drive Model
//
// POST /api/clients/{clientId}/documents/provision
//
// State machine flow:
//   1. If folderProvisionStatus === "complete"  → 409 ALREADY_PROVISIONED
//   2. If driveId exists + folderProvisionStatus === "pending"  → State E: resume folders
//   3. If no driveId  → States A+B+C+D: full provisioning
//
// State C persists driveId to Firestore BEFORE folder creation, so a retry
// after folder-creation failure will resume (State E) instead of creating
// a duplicate Shared Drive.
//
// Access: internal-admin only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createSharedDrive, createFolderTree } from '@/lib/drive/provision';

/**
 * Extract user claims from request headers (set by middleware).
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

  // ── Read client name ──────────────────────────────────────────────────────
  const clientName = configData.name as string;
  if (!clientName) {
    return NextResponse.json(
      { error: 'Client config is missing the "name" field', code: 'INVALID_CONFIG' },
      { status: 400 }
    );
  }

  // ── State E: Check existing provisioning state ────────────────────────────
  const existingDriveId = configData.driveId as string | undefined;
  const folderStatus = configData.folderProvisionStatus as string | undefined;

  // If folders are already complete → 409
  if (existingDriveId && folderStatus === 'complete') {
    return NextResponse.json(
      {
        error: 'Drive folders already provisioned for this client.',
        code: 'ALREADY_PROVISIONED',
        driveId: existingDriveId,
      },
      { status: 409 }
    );
  }

  // Also check legacy driveFolderId (Cegid Spain etc.)
  if (!existingDriveId && configData.driveFolderId) {
    return NextResponse.json(
      {
        error: 'Drive folders already provisioned for this client (legacy).',
        code: 'ALREADY_PROVISIONED',
        driveId: configData.driveFolderId,
      },
      { status: 409 }
    );
  }

  // ── Determine: fresh provision or resume ──────────────────────────────────
  let driveId = existingDriveId;
  let sharedDriveName: string | undefined;

  if (!driveId) {
    // ── States A + B: Create Shared Drive + add SA ────────────────────────
    try {
      const driveResult = await createSharedDrive(clientId, clientName);
      driveId = driveResult.sharedDriveId;
      sharedDriveName = driveResult.sharedDriveName;
    } catch (err) {
      const driveError = err as { code?: number; message?: string; errors?: unknown[] };
      console.error(
        '[documents/provision] States A/B failed:',
        driveError.message,
        driveError.errors
      );

      // Record the error on the config
      await configRef.update({
        lastProvisionAttemptAt: FieldValue.serverTimestamp(),
        lastProvisionError: {
          code: String(driveError.code || 'UNKNOWN'),
          message: driveError.message || 'Unknown error during Shared Drive creation',
        },
      });

      return NextResponse.json(
        {
          error: 'Failed to create Shared Drive',
          code: 'DRIVE_CREATE_ERROR',
          detail: driveError.message,
        },
        { status: 500 }
      );
    }

    // ── State C: Persist driveId IMMEDIATELY (before folder creation) ─────
    await configRef.update({
      driveId,
      driveProvisionStatus: 'created',
      folderProvisionStatus: 'pending',
      driveProvisionedAt: FieldValue.serverTimestamp(),
      driveProvisionedBy: user.email,
      lastProvisionAttemptAt: FieldValue.serverTimestamp(),
      lastProvisionError: null,
    });

    console.log(`[documents/provision] State C: driveId=${driveId} persisted to Firestore`);
  } else {
    // ── State E: Resuming folder creation for existing drive ──────────────
    console.log(`[documents/provision] State E: Resuming folder creation for driveId=${driveId}`);
    sharedDriveName = configData.sharedDriveName || `${clientName} (Client)`;

    // Update attempt timestamp
    await configRef.update({
      lastProvisionAttemptAt: FieldValue.serverTimestamp(),
      lastProvisionError: null,
    });
  }

  // ── State D: Create folder tree with retry ──────────────────────────────
  try {
    const folderResult = await createFolderTree(driveId);

    // ── Update Firestore: folders complete ─────────────────────────────────
    await configRef.update({
      folderProvisionStatus: 'complete',
      lastProvisionAttemptAt: FieldValue.serverTimestamp(),
      lastProvisionError: null,
    });

    return NextResponse.json(
      {
        success: true,
        resumed: !!existingDriveId,
        data: {
          sharedDriveId: driveId,
          sharedDriveName: sharedDriveName || `${clientName} (Client)`,
          folders: folderResult.folders,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const folderError = err as { code?: number; message?: string; errors?: unknown[] };
    console.error(
      '[documents/provision] State D failed (folder creation):',
      folderError.message,
      folderError.errors
    );

    // Record the error — driveId is already persisted, so next call will resume (State E)
    await configRef.update({
      lastProvisionAttemptAt: FieldValue.serverTimestamp(),
      lastProvisionError: {
        code: String(folderError.code || 'UNKNOWN'),
        message: folderError.message || 'Unknown error during folder creation',
      },
    });

    return NextResponse.json(
      {
        error: 'Shared Drive created but folder creation failed. Call again to retry.',
        code: 'FOLDER_CREATE_ERROR',
        driveId,
        detail: folderError.message,
      },
      { status: 500 }
    );
  }
}
