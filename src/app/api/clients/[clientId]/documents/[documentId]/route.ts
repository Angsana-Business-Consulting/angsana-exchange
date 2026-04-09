// =============================================================================
// Angsana Exchange — Document Soft-Delete API Route
// Slice 7A Step 4, Step 14: Soft-delete a registered document
//
// DELETE /api/clients/{clientId}/documents/{documentId}
//
// Soft-deletes a document: trashes the file in Google Drive, then marks the
// Firestore registry entry as deleted. Drive operation first — if Drive
// fails, Firestore is not touched. If Firestore update fails after Drive
// trash succeeds, the error is logged but a partial success is returned.
//
// The file is NOT permanently deleted — Drive trash is recoverable for 30
// days. The Firestore entry is kept with status='deleted' for audit trail.
//
// Access: internal-admin and internal-user only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getDriveClientAsSA, getDriveClient } from '@/lib/drive/client';
import { getUserFromHeaders, hasClientAccess, isInternal } from '@/lib/api/middleware/user-context';

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * DELETE /api/clients/{clientId}/documents/{documentId}
 *
 * Soft-deletes the document:
 *   1. Trashes the file in Google Drive
 *   2. Updates Firestore registry: status='deleted', deletedAt, deletedBy
 *
 * Returns the updated document metadata.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; documentId: string }> }
) {
  const { clientId, documentId } = await params;
  const user = getUserFromHeaders(request);

  // ── Auth: internal roles only ───────────────────────────────────────────
  if (!isInternal(user.role)) {
    return NextResponse.json(
      { error: 'Forbidden: only internal users can delete documents', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json(
      { error: 'Forbidden: no access to this client', code: 'FORBIDDEN' },
      { status: 403 }
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

  if (docData.status === 'deleted') {
    return NextResponse.json(
      { error: 'Document is already deleted', code: 'ALREADY_DELETED' },
      { status: 400 }
    );
  }

  const driveFileId = docData.driveFileId as string;

  // ── Read client config to determine Drive type ──────────────────────────
  const configDoc = await adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .get();

  const configData = configDoc.data();
  const isSharedDrive = !!configData?.driveId;

  // ── Drive trash first ───────────────────────────────────────────────────
  try {
    const drive = isSharedDrive ? await getDriveClientAsSA() : getDriveClient();
    await drive.files.update({
      fileId: driveFileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    });

    console.log(`[documents/delete] Drive file ${driveFileId} trashed`);
  } catch (err) {
    const driveError = err as { code?: number; message?: string };
    if (driveError.code === 404) {
      // File already gone from Drive — proceed to mark as deleted in Firestore
      console.warn(`[documents/delete] Drive file ${driveFileId} not found (already deleted?) — proceeding with Firestore soft-delete`);
    } else {
      console.error('[documents/delete] Drive trash failed:', driveError.message);
      return NextResponse.json(
        { error: 'Failed to trash file in Google Drive', code: 'DRIVE_API_ERROR' },
        { status: 500 }
      );
    }
  }

  // ── Firestore soft-delete (Drive succeeded) ─────────────────────────────
  const now = new Date().toISOString();
  let firestoreFailed = false;

  try {
    await docRef.update({
      status: 'deleted',
      deletedAt: now,
      deletedBy: user.uid,
      lastModifiedAt: now,
      lastModifiedBy: user.uid,
    });

    console.log(`[documents/delete] Registry entry ${documentId} marked as deleted`);
  } catch (err) {
    // Drive trash succeeded but Firestore failed — log but don't fail
    firestoreFailed = true;
    console.error(
      `[documents/delete] PARTIAL SUCCESS: Drive file ${driveFileId} was trashed ` +
      `but Firestore registry update failed. Manual fix needed.`,
      err
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      documentId,
      driveFileId,
      name: docData.name,
      status: 'deleted',
      deletedAt: now,
      deletedBy: user.uid,
      firestoreSyncFailed: firestoreFailed,
    },
  });
}
