// =============================================================================
// Angsana Exchange — Create New Google Document API
// POST /api/clients/{clientId}/documents/create
//
// Creates an empty Google Docs/Sheets/Slides file in the specified folder.
// Internal users only — client users upload files, they don't create new ones.
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

/** Valid Google Workspace types that can be created */
const VALID_TYPES: Record<string, string> = {
  document: 'application/vnd.google-apps.document',
  spreadsheet: 'application/vnd.google-apps.spreadsheet',
  presentation: 'application/vnd.google-apps.presentation',
};

function resolveVisibility(
  folderCategory: string,
  folderTemplate: DocumentFolderItem[]
): FolderVisibility {
  const match = folderTemplate.find((f) => f.folderCategory === folderCategory);
  return match?.visibility || 'internal-only';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const user = getUserFromHeaders(request);

  // Internal only
  if (!isInternal(user.role)) {
    return NextResponse.json(
      { error: 'Forbidden: only internal users can create documents', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json(
      { error: 'Forbidden: no access to this client', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // Parse body
  let body: { name?: string; type?: string; folderId?: string; campaignRef?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_REQUEST' }, { status: 400 });
  }

  const { name, type, folderId, campaignRef } = body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Missing name', code: 'MISSING_NAME' }, { status: 400 });
  }
  if (!type || !VALID_TYPES[type]) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${Object.keys(VALID_TYPES).join(', ')}`, code: 'INVALID_TYPE' },
      { status: 400 }
    );
  }
  if (!folderId || typeof folderId !== 'string') {
    return NextResponse.json({ error: 'Missing folderId', code: 'MISSING_FOLDER_ID' }, { status: 400 });
  }

  // Read client config
  const configRef = adminDb
    .collection('tenants').doc(user.tenantId)
    .collection('clients').doc(clientId);
  const configDoc = await configRef.get();
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

  // Verify folder is within client's tree
  try {
    const isValid = await isFolderWithinRoot(folderId, rootId, isSharedDrive);
    if (!isValid) {
      return NextResponse.json({ error: 'Forbidden: folder not in client tree', code: 'FORBIDDEN' }, { status: 403 });
    }
  } catch (err) {
    const driveError = err as { code?: number; message?: string };
    console.error('[documents/create] Folder validation error:', driveError.message);
    return NextResponse.json({ error: 'Drive API error', code: 'DRIVE_API_ERROR' }, { status: 500 });
  }

  // Create empty Google file in Drive
  const mimeType = VALID_TYPES[type];
  let driveFile;
  try {
    const drive = isSharedDrive ? await getDriveClientAsSA() : getDriveClient();
    const response = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: name.trim(),
        mimeType,
        parents: [folderId],
      },
      fields: 'id, name, mimeType, size, createdTime',
    });
    driveFile = response.data;
  } catch (err) {
    const driveError = err as { message?: string };
    console.error('[documents/create] Drive API error:', driveError.message);
    return NextResponse.json({ error: 'Failed to create file in Drive', code: 'DRIVE_API_ERROR' }, { status: 500 });
  }

  // Create Firestore registry entry
  let registryEntry = null;
  if (folderMap) {
    const folderInfo = lookupFolderCategory(folderId, folderMap);
    if (folderInfo) {
      let visibility: FolderVisibility = 'internal-only';
      try {
        const template = await getDocumentFolderTemplate(user.tenantId);
        visibility = resolveVisibility(folderInfo.folderCategory, template);
      } catch (err) {
        console.warn('[documents/create] Visibility resolution failed:', err);
      }

      const now = new Date().toISOString();
      const registryData = {
        driveFileId: driveFile.id!,
        name: driveFile.name!,
        mimeType: driveFile.mimeType!,
        size: 0,
        folderCategory: folderInfo.folderCategory,
        folderId,
        visibility,
        status: 'active',
        campaignRef: campaignRef || null,
        registrySource: 'exchange_create',
        uploadedBy: user.uid,
        uploadedByName: user.email || user.uid,
        uploadedAt: now,
        lastModifiedAt: now,
        lastModifiedBy: user.uid,
        deletedAt: null,
        deletedBy: null,
        storageBackend: 'gdrive',
      };

      try {
        const docRef = await adminDb
          .collection('tenants').doc(user.tenantId)
          .collection('clients').doc(clientId)
          .collection('documents')
          .add(registryData);
        registryEntry = { documentId: docRef.id, ...registryData };
        console.log(`[documents/create] Registry entry: ${docRef.id} for ${driveFile.id}`);
      } catch (err) {
        console.error('[documents/create] Registry write failed:', err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      id: driveFile.id,
      name: driveFile.name,
      mimeType: driveFile.mimeType,
      registry: registryEntry ? { documentId: registryEntry.documentId } : null,
    },
  }, { status: 201 });
}
