// =============================================================================
// Angsana Exchange — Document Upload API Route
// Slice 7A Step 3: File Download & Upload Streaming Routes
// Updated for Shared Drive support (Slice 7A Step 2/3 Revision)
//
// POST /api/clients/{clientId}/documents/upload
//
// Accepts a multipart form data upload and creates the file in the specified
// folder within the client's Google Drive tree. Files are buffered in memory
// (up to 50MB limit) — acceptable for Cloud Run 512Mi.
//
// Supports both Shared Drives (driveId) and legacy regular folders (driveFolderId).
//
// Access: internal-admin and internal-user only for this step.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { uploadToDrive } from '@/lib/drive/upload';
import { isFolderWithinRoot } from '@/lib/drive/browse';

export const runtime = 'nodejs';

/** Maximum file size: 50MB */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserFromHeaders(request: NextRequest) {
  return {
    uid: request.headers.get('x-user-uid') || '',
    role: request.headers.get('x-user-role') || '',
    tenantId: request.headers.get('x-user-tenant') || 'angsana',
    email: request.headers.get('x-user-email') || '',
    clientId: request.headers.get('x-user-client') || null,
    assignedClients: JSON.parse(request.headers.get('x-assigned-clients') || '[]') as string[],
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

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * POST /api/clients/{clientId}/documents/upload
 *
 * Accepts multipart form data with:
 *   - file: the file to upload
 *   - folderId: the Drive folder ID to upload into (must be in client's tree)
 *
 * Returns the created file's metadata from Drive.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const user = getUserFromHeaders(request);

  // ── Auth: internal roles only for this step ─────────────────────────────
  if (!isInternal(user.role)) {
    return NextResponse.json(
      { error: 'Forbidden: only internal users can upload documents in this step', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json(
      { error: 'Forbidden: no access to this client', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // ── Parse multipart form data ───────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid multipart form data', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  }

  const file = formData.get('file') as File | null;
  const folderId = formData.get('folderId') as string | null;

  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: 'No file provided in the upload', code: 'MISSING_FILE' },
      { status: 400 }
    );
  }

  if (!folderId || typeof folderId !== 'string' || folderId.trim() === '') {
    return NextResponse.json(
      { error: 'Missing folderId — specify the target Drive folder', code: 'MISSING_FOLDER_ID' },
      { status: 400 }
    );
  }

  // ── File size check ─────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 50MB limit`,
        code: 'PAYLOAD_TOO_LARGE',
      },
      { status: 413 }
    );
  }

  // ── Read client config to get driveId or driveFolderId ──────────────────
  const configDoc = await adminDb
    .collection('tenants')
    .doc(user.tenantId)
    .collection('clients')
    .doc(clientId)
    .get();

  if (!configDoc.exists) {
    return NextResponse.json(
      { error: 'Client not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const configData = configDoc.data()!;

  // driveId = Shared Drive (new model), driveFolderId = regular folder (legacy)
  const rootId = (configData.driveId || configData.driveFolderId) as string | undefined;

  if (!rootId) {
    return NextResponse.json(
      { error: 'No Drive folder configured for this client', code: 'NO_DRIVE_FOLDER' },
      { status: 404 }
    );
  }

  // ── Verify target folder is within client's Drive tree ──────────────────
  try {
    const isValid = await isFolderWithinRoot(folderId, rootId);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Forbidden: target folder is not within this client\'s Drive folder', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
  } catch (err) {
    const driveError = err as { code?: number; message?: string };
    if (driveError.code === 404) {
      return NextResponse.json(
        { error: 'Target folder not found in Drive', code: 'FOLDER_NOT_FOUND' },
        { status: 404 }
      );
    }
    console.error('[documents/upload] Folder validation error:', driveError.message);
    return NextResponse.json(
      { error: 'Drive API error during folder validation', code: 'DRIVE_API_ERROR' },
      { status: 500 }
    );
  }

  // ── Upload file to Drive ────────────────────────────────────────────────
  try {
    // Buffer the file content (acceptable for ≤50MB on 512Mi Cloud Run)
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'application/octet-stream';

    const result = await uploadToDrive(file.name, mimeType, buffer, folderId);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: result.id,
          name: result.name,
          mimeType: result.mimeType,
          size: result.size,
          folderId,
          createdTime: result.createdTime,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const driveError = err as { code?: number; message?: string };

    console.error('[documents/upload] Drive API error:', driveError.message);
    return NextResponse.json(
      { error: 'Failed to upload file to Google Drive', code: 'DRIVE_API_ERROR' },
      { status: 500 }
    );
  }
}
