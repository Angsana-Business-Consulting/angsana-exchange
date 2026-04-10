// =============================================================================
// Angsana Exchange — Move Document to Different Folder
// PATCH /api/clients/{clientId}/documents/{documentId}/move
//
// Moves a file to a different folder in the client's Drive tree.
// Updates both Drive (file.update parents) and Firestore registry.
// Internal users only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getDriveClientAsSA, getDriveClient } from '@/lib/drive/client';
import { isFolderWithinRoot } from '@/lib/drive/browse';
import { getUserFromHeaders, hasClientAccess, isInternal } from '@/lib/api/middleware/user-context';
import { lookupFolderCategory } from '@/lib/drive/visibility';
import { getDocumentFolderTemplate } from '@/lib/drive/folder-template-loader';
import type { FolderMap, FolderVisibility, DocumentFolderItem } from '@/types';

export const runtime = 'nodejs';

function resolveVisibility(
  folderCategory: string,
  folderTemplate: DocumentFolderItem[]
): FolderVisibility {
  const match = folderTemplate.find((f) => f.folderCategory === folderCategory);
  return match?.visibility || 'internal-only';
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; documentId: string }> }
) {
  const { clientId, documentId } = await params;
  const user = getUserFromHeaders(request);

  if (!isInternal(user.role)) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }
  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }

  // Parse body
  let body: { targetFolderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_REQUEST' }, { status: 400 });
  }

  const { targetFolderId } = body;
  if (!targetFolderId || typeof targetFolderId !== 'string') {
    return NextResponse.json({ error: 'Missing targetFolderId', code: 'MISSING_FIELD' }, { status: 400 });
  }

  // Load document from Firestore
  const docRef = adminDb
    .collection('tenants').doc(user.tenantId)
    .collection('clients').doc(clientId)
    .collection('documents').doc(documentId);

  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return NextResponse.json({ error: 'Document not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const docData = docSnap.data()!;
  const driveFileId = docData.driveFileId as string;
  const currentFolderId = docData.folderId as string;

  if (currentFolderId === targetFolderId) {
    return NextResponse.json({ error: 'Already in that folder', code: 'NO_CHANGE' }, { status: 400 });
  }

  // Read client config
  const configDoc = await adminDb
    .collection('tenants').doc(user.tenantId)
    .collection('clients').doc(clientId)
    .get();

  if (!configDoc.exists) {
    return NextResponse.json({ error: 'Client not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const configData = configDoc.data()!;
  const driveId = configData.driveId as string | undefined;
  const rootId = (driveId || configData.driveFolderId) as string | undefined;
  const isSharedDrive = !!driveId;
  const folderMap = (configData.folderMap || null) as FolderMap | null;

  if (!rootId) {
    return NextResponse.json({ error: 'No Drive folder configured', code: 'NO_DRIVE_FOLDER' }, { status: 404 });
  }

  // Verify target folder is within client tree
  try {
    const isValid = await isFolderWithinRoot(targetFolderId, rootId, isSharedDrive);
    if (!isValid) {
      return NextResponse.json({ error: 'Target folder not in client tree', code: 'FORBIDDEN' }, { status: 403 });
    }
  } catch (err) {
    const driveError = err as { message?: string };
    console.error('[documents/move] Folder validation error:', driveError.message);
    return NextResponse.json({ error: 'Drive API error', code: 'DRIVE_API_ERROR' }, { status: 500 });
  }

  // Move file in Drive: remove old parent, add new parent
  try {
    const drive = isSharedDrive ? await getDriveClientAsSA() : getDriveClient();
    await drive.files.update({
      fileId: driveFileId,
      supportsAllDrives: true,
      addParents: targetFolderId,
      removeParents: currentFolderId,
      fields: 'id, parents',
    });
  } catch (err) {
    const driveError = err as { message?: string };
    console.error('[documents/move] Drive move error:', driveError.message);
    return NextResponse.json({ error: 'Failed to move file in Drive', code: 'DRIVE_API_ERROR' }, { status: 500 });
  }

  // Update Firestore registry
  const updateData: Record<string, unknown> = {
    folderId: targetFolderId,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: user.uid,
  };

  // Resolve new folderCategory and visibility
  if (folderMap) {
    const folderInfo = lookupFolderCategory(targetFolderId, folderMap);
    if (folderInfo) {
      updateData.folderCategory = folderInfo.folderCategory;
      try {
        const template = await getDocumentFolderTemplate(user.tenantId);
        updateData.visibility = resolveVisibility(folderInfo.folderCategory, template);
      } catch {
        updateData.visibility = 'internal-only';
      }
    }
  }

  try {
    await docRef.update(updateData);
  } catch (err) {
    console.error('[documents/move] Firestore update failed:', err);
    // Drive move succeeded, Firestore failed — log but report partial success
  }

  console.log(`[documents/move] Moved ${documentId} from ${currentFolderId} to ${targetFolderId}`);

  return NextResponse.json({
    success: true,
    data: {
      documentId,
      targetFolderId,
      folderCategory: updateData.folderCategory || null,
    },
  });
}
