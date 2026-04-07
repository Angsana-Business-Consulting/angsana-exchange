// =============================================================================
// Angsana Exchange — Document Download API Route
// Slice 7A Step 3: File Download & Upload Streaming Routes
// Updated for Shared Drive support (Slice 7A Step 2/3 Revision)
//
// GET /api/clients/{clientId}/documents/download/{fileId}
//
// Streams a file from Google Drive through Exchange. Handles both binary
// files and Google Workspace exports (Docs→PDF, Sheets→xlsx, Slides→PDF).
// No direct Drive URLs are ever exposed to the caller.
//
// Supports both Shared Drives (driveId) and legacy regular folders (driveFolderId).
//
// Access: internal-admin and internal-user only for this step.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { adminDb } from '@/lib/firebase/admin';
import { downloadDriveFile } from '@/lib/drive/download';
import { isFileWithinRoot } from '@/lib/drive/browse';

export const runtime = 'nodejs';

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

/**
 * Sanitise a filename for use in Content-Disposition header.
 * Removes characters that break the header (quotes, newlines, backslashes).
 * For non-ASCII filenames, uses RFC 5987 encoding.
 */
function sanitiseFilename(name: string): string {
  // Replace characters that are problematic in Content-Disposition
  const safe = name
    .replace(/[\r\n]/g, '')
    .replace(/"/g, "'")
    .replace(/\\/g, '_');

  // Check if name is ASCII-safe
  const isAscii = /^[\x20-\x7E]+$/.test(safe);

  if (isAscii) {
    return `attachment; filename="${safe}"`;
  }

  // RFC 5987: filename*=UTF-8''encoded_name for non-ASCII
  const encoded = encodeURIComponent(safe).replace(/'/g, '%27');
  return `attachment; filename="${safe.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encoded}`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * GET /api/clients/{clientId}/documents/download/{fileId}
 *
 * Streams a file from the client's Google Drive folder through Exchange.
 * Sets Content-Type, Content-Disposition, and Content-Length headers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; fileId: string }> }
) {
  const { clientId, fileId } = await params;
  const user = getUserFromHeaders(request);

  // ── Auth: internal roles only for this step ─────────────────────────────
  if (!isInternal(user.role)) {
    return NextResponse.json(
      { error: 'Forbidden: only internal users can download documents in this step', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  if (!hasClientAccess(user, clientId)) {
    return NextResponse.json(
      { error: 'Forbidden: no access to this client', code: 'FORBIDDEN' },
      { status: 403 }
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

  // ── Verify file belongs to client's Drive tree ──────────────────────────
  // Top-down BFS: walk the folder tree from the root and look for the fileId.
  // Same approach as isFolderWithinRoot — works with inherited sharing where
  // files.get doesn't return the `parents` field.
  try {
    const fileInTree = await isFileWithinRoot(fileId, rootId);
    if (!fileInTree) {
      return NextResponse.json(
        { error: 'Forbidden: file is not within this client\'s Drive folder', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
  } catch (err) {
    const driveError = err as { code?: number; message?: string };
    console.error('[documents/download] File validation error:', driveError.message);
    return NextResponse.json(
      { error: 'Drive API error during file validation', code: 'DRIVE_API_ERROR' },
      { status: 500 }
    );
  }

  // ── Download / export the file ──────────────────────────────────────────
  try {
    const result = await downloadDriveFile(fileId);

    // Determine response headers
    const contentType = result.isExport
      ? result.exportMimeType!
      : result.metadata.mimeType;

    const filename = result.isExport
      ? result.exportFilename!
      : result.metadata.name;

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': sanitiseFilename(filename),
    };

    // Content-Length only if known (not available for Google Workspace exports)
    if (!result.isExport && result.metadata.size) {
      headers['Content-Length'] = String(result.metadata.size);
    }

    // Convert Node.js Readable to Web ReadableStream for the response
    const webStream = Readable.toWeb(result.stream) as ReadableStream;

    return new Response(webStream, { headers });
  } catch (err) {
    const driveError = err as { code?: number; message?: string };

    if (driveError.code === 404) {
      return NextResponse.json(
        { error: 'File not found in Drive', code: 'FILE_NOT_FOUND' },
        { status: 404 }
      );
    }

    console.error('[documents/download] Drive API error:', driveError.message);
    return NextResponse.json(
      { error: 'Failed to download file from Google Drive', code: 'DRIVE_API_ERROR' },
      { status: 500 }
    );
  }
}
