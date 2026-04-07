// =============================================================================
// Angsana Exchange — Drive Browse
// Slice 7A: Google Drive API Connectivity & Browse Endpoint
// Updated for Shared Drive support (Slice 7A Step 2/3 Revision)
//
// Lists folder contents via the Drive API. Returns structured DriveItem[]
// with no direct Drive URLs (webViewLink is intentionally excluded).
//
// Supports both Shared Drives (new clients with driveId) and regular folders
// (legacy clients with driveFolderId) via the sharedDriveId parameter.
// =============================================================================

import { getDriveClient } from './client';
import { DRIVE_FOLDER_MIME_TYPE, type DriveItem } from './types';

/**
 * List the contents of a Google Drive folder by ID.
 *
 * Returns files and subfolders (excluding trashed items), sorted with
 * folders first then alphabetical by name.
 *
 * @param folderId - The Google Drive folder ID to list
 * @param sharedDriveId - If provided, uses Shared Drive query mode
 *   (corpora: 'drive', driveId). Required when listing the root of a
 *   Shared Drive. For subfolder listings within a Shared Drive, the
 *   'in parents' query works with supportsAllDrives alone, but passing
 *   sharedDriveId ensures consistent behaviour.
 * @returns Array of DriveItem objects (no direct Drive URLs)
 * @throws Error if the Drive API call fails (caller should handle)
 */
export async function listFolderContents(
  folderId: string,
  sharedDriveId?: string
): Promise<DriveItem[]> {
  const drive = getDriveClient();

  // Build the files.list params — Shared Drive vs regular folder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listParams: any = {
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, modifiedTime, createdTime, iconLink, webViewLink)',
    orderBy: 'folder,name',
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  };

  // When listing within a Shared Drive, set corpora to 'drive' and specify
  // the driveId. This is essential for root-level listings where the parent
  // IS the Shared Drive ID.
  if (sharedDriveId) {
    listParams.corpora = 'drive';
    listParams.driveId = sharedDriveId;
  }

  const response = await drive.files.list(listParams);

  const files = response.data.files || [];

  // Map to DriveItem — deliberately exclude webViewLink from output.
  // Exchange wraps Drive completely; clients never see raw Drive URLs.
  return files.map((file): DriveItem => ({
    id: file.id || '',
    name: file.name || '',
    mimeType: file.mimeType || '',
    isFolder: file.mimeType === DRIVE_FOLDER_MIME_TYPE,
    size: file.size ? parseInt(file.size, 10) : null,
    modifiedTime: file.modifiedTime || '',
    createdTime: file.createdTime || '',
    iconLink: file.iconLink || null,
  }));
}

/**
 * Verify that a target folder is within a client's folder tree using a
 * top-down breadth-first search from the root.
 *
 * Why top-down instead of walking up via files.get('parents')?
 * The SA has inherited access (shared on the root folder, not on each child).
 * Drive API doesn't return the `parents` field for files accessed via
 * inherited permissions. So we walk DOWN from the root using files.list
 * (which works with inherited access) and check if the target folder
 * appears anywhere in the tree.
 *
 * Max depth: 5 levels (client folder trees are shallow: 2–3 levels typical).
 * Handles folders created by anyone (Make.com, AMs manually, Exchange).
 *
 * @param targetFolderId - The folder the caller wants to browse
 * @param rootFolderId - The client's root driveId or driveFolderId from config
 * @returns true if targetFolderId is within rootFolderId's tree
 */
export async function isFolderWithinRoot(
  targetFolderId: string,
  rootFolderId: string
): Promise<boolean> {
  // If they're the same, it's the root — always valid
  if (targetFolderId === rootFolderId) return true;

  const drive = getDriveClient();

  // BFS: start with the root's direct children, expand level by level
  let currentLevel = [rootFolderId];

  for (let depth = 0; depth < 5; depth++) {
    if (currentLevel.length === 0) break;

    const nextLevel: string[] = [];

    // Check each folder at this level for child folders
    for (const parentId of currentLevel) {
      const response = await drive.files.list({
        q: `'${parentId}' in parents and mimeType = '${DRIVE_FOLDER_MIME_TYPE}' and trashed = false`,
        fields: 'files(id)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const folders = response.data.files || [];

      // Check if the target folder is among the children at this level
      for (const folder of folders) {
        if (folder.id === targetFolderId) {
          return true;
        }
        // Queue this folder for next-level search
        if (folder.id) {
          nextLevel.push(folder.id);
        }
      }
    }

    currentLevel = nextLevel;
  }

  return false;
}

/**
 * Verify that a target file (not a folder) exists within a client's folder tree
 * using a top-down breadth-first search from the root.
 *
 * Same approach as isFolderWithinRoot but lists ALL items (not just folders)
 * at each level and checks if the target fileId appears. This works with
 * inherited sharing where files.get doesn't return the `parents` field.
 *
 * @param targetFileId - The file ID the caller wants to download
 * @param rootFolderId - The client's root driveId or driveFolderId from config
 * @returns true if targetFileId is found anywhere in rootFolderId's tree
 */
export async function isFileWithinRoot(
  targetFileId: string,
  rootFolderId: string
): Promise<boolean> {
  const drive = getDriveClient();

  // BFS: start with the root folder, expand subfolders level by level
  let currentLevel = [rootFolderId];

  for (let depth = 0; depth < 5; depth++) {
    if (currentLevel.length === 0) break;

    const nextLevel: string[] = [];

    for (const parentId of currentLevel) {
      const response = await drive.files.list({
        q: `'${parentId}' in parents and trashed = false`,
        fields: 'files(id, mimeType)',
        pageSize: 200,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const items = response.data.files || [];

      for (const item of items) {
        if (item.id === targetFileId) {
          return true;
        }
        // Queue subfolders for next-level search
        if (item.mimeType === DRIVE_FOLDER_MIME_TYPE && item.id) {
          nextLevel.push(item.id);
        }
      }
    }

    currentLevel = nextLevel;
  }

  return false;
}
