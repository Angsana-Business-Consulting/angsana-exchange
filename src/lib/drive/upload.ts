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

// ─── Google Format Conversion ─────────────────────────────────────────────────

/**
 * Maps Office/text mimeTypes to their Google Workspace equivalents.
 * When uploading with a target Google mimeType in requestBody, Drive auto-converts.
 */
const GOOGLE_CONVERT_MAP: Record<string, string> = {
  // Word → Google Docs
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.google-apps.document',
  'application/msword': 'application/vnd.google-apps.document',
  'application/rtf': 'application/vnd.google-apps.document',
  'text/plain': 'application/vnd.google-apps.document',
  'text/html': 'application/vnd.google-apps.document',
  // Excel → Google Sheets
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/vnd.google-apps.spreadsheet',
  'application/vnd.ms-excel': 'application/vnd.google-apps.spreadsheet',
  'text/csv': 'application/vnd.google-apps.spreadsheet',
  // PowerPoint → Google Slides
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'application/vnd.google-apps.presentation',
  'application/vnd.ms-powerpoint': 'application/vnd.google-apps.presentation',
};

/**
 * Get the Google Workspace mimeType for a given source mimeType, or null if
 * the format is not convertible (e.g. PDF, images, archives).
 */
export function getGoogleConvertMimeType(sourceMimeType: string): string | null {
  return GOOGLE_CONVERT_MAP[sourceMimeType] || null;
}

/**
 * Strip the Office extension from a filename when converting to Google format.
 * E.g. "Script.docx" → "Script"  (Google Docs don't have extensions)
 */
function stripOfficeExtension(fileName: string): string {
  return fileName.replace(/\.(docx?|xlsx?|pptx?|rtf|csv|txt|html?)$/i, '');
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
  isSharedDrive?: boolean,
  /** Optional: convert to this Google Workspace mimeType (e.g. for .docx → Google Docs) */
  convertToMimeType?: string
): Promise<UploadResult> {
  // Use the JWT SA client for Shared Drives (identity must match the SA added
  // as Content Manager). Use ADC client for legacy regular folders.
  const drive = isSharedDrive ? await getDriveClientAsSA() : getDriveClient();

  // When converting, the requestBody.mimeType is the Google target format and
  // media.mimeType is the source format. Also strip Office extensions from name.
  const targetMimeType = convertToMimeType || mimeType;
  const displayName = convertToMimeType ? stripOfficeExtension(fileName) : fileName;

  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: displayName,
      mimeType: targetMimeType,
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
