// =============================================================================
// Angsana Exchange — Drive File Upload
// Slice 7A Step 3: File Download & Upload Streaming Routes
// Updated for Shared Drive support (Slice 7A Step 2/3 Revision)
//
// Uploads a file to a specified folder in Google Drive. Standalone reusable
// function — called from the upload API route in this step and reusable from
// future endpoints (e.g., client uploads in Step 6).
//
// supportsAllDrives: true is set on files.create so uploads work into both
// Shared Drives (new clients) and regular folders (legacy clients).
// =============================================================================

import { Readable } from 'stream';
import { getDriveClient, getDriveClientAsSA } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result of a successful file upload to Drive. */
export interface UploadResult {
  /** The Drive file ID of the newly created file */
  id: string;
  /** Filename as stored in Drive */
  name: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** ISO 8601 timestamp */
  createdTime: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload a file to a specific folder in Google Drive.
 *
 * @param fileName - The display name for the file in Drive
 * @param mimeType - The MIME type of the file content
 * @param content - The file content as a Buffer or Readable stream
 * @param targetFolderId - The Drive folder ID to upload into
 * @returns UploadResult with the new file's metadata
 * @throws Error if the Drive API call fails
 */
export async function uploadToDrive(
  fileName: string,
  mimeType: string,
  content: Buffer | Readable,
  targetFolderId: string,
  isSharedDrive?: boolean
): Promise<UploadResult> {
  // Use the JWT SA client for Shared Drives (identity must match the SA added
  // as Content Manager). Use ADC client for legacy regular folders.
  const drive = isSharedDrive ? await getDriveClientAsSA() : getDriveClient();

  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      mimeType,
      parents: [targetFolderId],
    },
    media: {
      mimeType,
      body: content instanceof Buffer ? Readable.from(content) : content,
    },
    fields: 'id, name, mimeType, size, createdTime',
  });

  const file = response.data;

  return {
    id: file.id || '',
    name: file.name || fileName,
    mimeType: file.mimeType || mimeType,
    size: file.size ? parseInt(file.size, 10) : 0,
    createdTime: file.createdTime || new Date().toISOString(),
  };
}
