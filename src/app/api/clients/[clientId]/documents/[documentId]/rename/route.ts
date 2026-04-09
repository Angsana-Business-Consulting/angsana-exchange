// =============================================================================
// Angsana Exchange — Document Rename API Route
// Slice 7A Step 4, Step 13: Rename a registered document
//
// PATCH /api/clients/{clientId}/documents/{documentId}/rename
//
// Renames a file in Google Drive, then updates the Firestore registry.
// Drive operation first — if Drive fails, Firestore is not touched.
// If Firestore update fails after Drive rename succeeds, the error is logged
// but a partial success is returned (Drive was renamed).
//
// Extension preservation:
//   If the user provides a new name without a file extension, the original
//   extension is automatically appended. E.g., renaming "report.pdf" to
//   "Q4 report" becomes "Q4 report.pdf".
//
// Access: internal-admin and internal-user only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getDriveClientAsSA, getDriveClient } from '@/lib/drive/client';
import { getUserFromHeaders, hasClientAccess, isInternal } from '@/lib/api/middleware/user-context';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the file extension from a filename, including the dot.
 * Returns empty string if no extension found.
 * E.g., "report.pdf" → ".pdf", "README" → ""
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return ''; // No dot, or dot at position 0 (e.g., ".gitignore")
  return filename.substring(lastDot);
}

/**
 * Ensure the new name has the same extension as the original.
 * If the user already included the correct extension, it's kept as-is.
 * If the user included a different extension, it's kept (intentional change).
 * If the user omitted any extension, the original extension is appended.
 */
function preserveExtension(newName: string, originalName: string): string {
  const originalExt = getExtension(originalName);
  if (!originalExt) return newName; // Original had no extension — nothing to preserve

  const newExt = getExtension(newName);
  if (newExt) return newName; // User included an extension — respect it

  // User omitted extension — auto-append the original
  return `${newName}${originalExt}`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * PATCH /api/clients/{clientId}/documents/{documentId}/rename
 *
 * Request body (JSON):
 *   - name: string — the new filename
 *
 * Returns the updated document registry entry.
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
      { error: 'Forbidden: only internal users can rename documents', code: 'FORBIDDEN' },
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
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  }

  const rawName = body.name;
  if (!rawName || typeof rawName !== 'string' || rawName.trim() === '') {
    return NextResponse.json(
      { error: 'Missing required field: name', code: 'MISSING_FIELD' },
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
      { error: 'Cannot rename a deleted document', code: 'DOCUMENT_DELETED' },
      { status: 400 }
    );
  }

  const driveFileId = docData.driveFileId as string;
  const originalName = docData.name as string;

  // ── Resolve final name with extension preservation ──────────────────────
  const finalName = preserveExtension(rawName.trim(), originalName);

  // ── Read client config to determine Drive type ──────────────────────────
  const configDoc = await adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .get();

  const configData = configDoc.data();
  const isSharedDrive = !!configData?.driveId;

  // ── Drive rename first ──────────────────────────────────────────────────
  try {
    const drive = isSharedDrive ? await getDriveClientAsSA() : getDriveClient();
    await drive.files.update({
      fileId: driveFileId,
      requestBody: { name: finalName },
      supportsAllDrives: true,
    });

    console.log(`[documents/rename] Drive file ${driveFileId} renamed to "${finalName}"`);
  } catch (err) {
    const driveError = err as { code?: number; message?: string };
    if (driveError.code === 404) {
      return NextResponse.json(
        { error: 'Drive file not found — it may have been deleted externally', code: 'FILE_NOT_FOUND' },
        { status: 404 }
      );
    }
    console.error('[documents/rename] Drive rename failed:', driveError.message);
    return NextResponse.json(
      { error: 'Failed to rename file in Google Drive', code: 'DRIVE_API_ERROR' },
      { status: 500 }
    );
  }

  // ── Firestore update (Drive succeeded) ──────────────────────────────────
  const now = new Date().toISOString();
  let firestoreFailed = false;

  try {
    await docRef.update({
      name: finalName,
      lastModifiedAt: now,
      lastModifiedBy: user.uid,
    });

    console.log(`[documents/rename] Registry entry ${documentId} updated with name "${finalName}"`);
  } catch (err) {
    // Drive rename succeeded but Firestore failed — log but don't fail
    firestoreFailed = true;
    console.error(
      `[documents/rename] PARTIAL SUCCESS: Drive file ${driveFileId} was renamed to "${finalName}" ` +
      `but Firestore registry update failed. Manual fix needed.`,
      err
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      documentId,
      driveFileId,
      previousName: originalName,
      name: finalName,
      extensionPreserved: finalName !== rawName.trim(),
      lastModifiedAt: now,
      lastModifiedBy: user.uid,
      firestoreSyncFailed: firestoreFailed,
    },
  });
}
