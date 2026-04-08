// =============================================================================
// Angsana Exchange — Drive File Download / Export
// Slice 7A Step 3: File Download & Upload Streaming Routes
// Updated for Shared Drive support (Slice 7A Step 2/3 Revision)
//
// Downloads a binary file or exports a Google Workspace file from Drive.
// Returns a Node.js Readable stream plus metadata — the route handler
// converts to a Web ReadableStream for the HTTP response.
//
// Streaming is critical: files are piped through Exchange without buffering
// the entire content in memory (Cloud Run 512Mi limit).
// =============================================================================

import { Readable } from 'stream';
import { getDriveClient, getDriveClientAsSA } from './client';

// ─── Google Workspace MIME type mappings ──────────────────────────────────────

/** Map of Google Workspace MIME types to their export format + file extension */
const GOOGLE_WORKSPACE_EXPORT_MAP: Record<string, { exportMimeType: string; extension: string }> = {
  'application/vnd.google-apps.document': {
    exportMimeType: 'application/pdf',
    extension: '.pdf',
  },
  'application/vnd.google-apps.spreadsheet': {
    exportMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    exportMimeType: 'application/pdf',
    extension: '.pdf',
  },
};

/** Check whether a MIME type is a Google Workspace type that needs export */
export function isGoogleWorkspaceType(mimeType: string): boolean {
  return mimeType in GOOGLE_WORKSPACE_EXPORT_MAP;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DownloadResult {
  /** The file content as a Node.js Readable stream */
  stream: Readable;
  /** File metadata from Drive */
  metadata: {
    id: string;
    name: string;
    mimeType: string;
    size: number | null;
  };
  /** True if this was a Google Workspace file that was exported */
  isExport: boolean;
  /** The MIME type used for export (e.g., application/pdf). Null for binary files. */
  exportMimeType: string | null;
  /** Adjusted filename with correct extension for exports. Null for binary files. */
  exportFilename: string | null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Download a file from Google Drive, streaming the content.
 *
 * Handles two cases:
 * - Binary files (PDFs, images, Word docs): streamed directly via files.get
 * - Google Workspace files (Docs, Sheets, Slides): exported via files.export
 *
 * @param fileId - The Google Drive file ID to download
 * @returns DownloadResult with stream, metadata, and export info
 * @throws Error if the file doesn't exist or Drive API fails
 */
export async function downloadDriveFile(fileId: string, isSharedDrive?: boolean): Promise<DownloadResult> {
  // Use the JWT SA client for Shared Drives (identity must match the SA added
  // as Content Manager). Use ADC client for legacy regular folders.
  const drive = isSharedDrive ? await getDriveClientAsSA() : getDriveClient();

  // 1. Get file metadata first
  const metadataResponse = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size',
    supportsAllDrives: true,
  });

  const fileData = metadataResponse.data;
  const name = fileData.name || 'download';
  const mimeType = fileData.mimeType || 'application/octet-stream';
  const size = fileData.size ? parseInt(fileData.size, 10) : null;

  // 2. Check if this is a Google Workspace file that needs export
  const exportInfo = GOOGLE_WORKSPACE_EXPORT_MAP[mimeType];

  if (exportInfo) {
    // ── Google Workspace file: export to a downloadable format ───────────
    const exportResponse = await drive.files.export(
      {
        fileId,
        mimeType: exportInfo.exportMimeType,
        // Note: files.export doesn't have a supportsAllDrives param in the
        // API spec, but the export works for Shared Drive files as long as
        // the SA has access (which it does as Content Manager).
      },
      { responseType: 'stream' }
    );

    // Build export filename: strip any existing extension and add the export one
    const baseName = name.replace(/\.[^.]+$/, '');
    const exportFilename = `${baseName}${exportInfo.extension}`;

    return {
      stream: exportResponse.data as unknown as Readable,
      metadata: { id: fileId, name, mimeType, size },
      isExport: true,
      exportMimeType: exportInfo.exportMimeType,
      exportFilename,
    };
  }

  // ── Binary file: stream directly ────────────────────────────────────────
  const downloadResponse = await drive.files.get(
    {
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'stream' }
  );

  return {
    stream: downloadResponse.data as unknown as Readable,
    metadata: { id: fileId, name, mimeType, size },
    isExport: false,
    exportMimeType: null,
    exportFilename: null,
  };
}

