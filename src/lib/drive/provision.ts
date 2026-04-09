// =============================================================================
// Angsana Exchange — Shared Drive Provisioning (State Machine)
// Slice 7A Step 2/3 Revision: Shared Drive Model
// Slice 7A Step 4: Reads folder template from Firestore managed list
//
// State machine with early persistence and retry:
//
//   State A — Create Shared Drive (via impersonated client)
//   State B — Add SA as Content Manager
//   State C — Persist driveId to Firestore IMMEDIATELY (before folder creation)
//   State D — Create folder tree with retry (handles propagation delay)
//   State E — Recovery: resume folder creation if driveId exists but folders pending
//
// The folder structure is driven by the Document Folders managed list in
// Firestore (tenants/{tenantId}/managedLists/documentFolders).
// =============================================================================

import { getDriveClientAsSA, getDriveClientWithImpersonation, getSAEmail } from './client';
import { DRIVE_FOLDER_MIME_TYPE } from './types';
import type { DocumentFolderItem, FolderMapEntry } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max retry attempts for folder creation (handles permission propagation delay) */
const FOLDER_CREATE_MAX_RETRIES = 5;

/** Delay between retries in ms */
const FOLDER_CREATE_RETRY_DELAY_MS = 2000;

/** HTTP status codes that indicate propagation-related transient errors */
const RETRYABLE_STATUS_CODES = [404, 403];

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single folder created during provisioning. */
export interface ProvisionedFolder {
  name: string;
  folderId: string;
  parentId: string;
  visibility: 'client-visible' | 'internal-only';
}

/** Result of States A+B: Shared Drive created, SA added. */
export interface SharedDriveCreationResult {
  sharedDriveId: string;
  sharedDriveName: string;
}

/** Result of State D: folder tree created, folderMap built. */
export interface FolderCreationResult {
  folders: ProvisionedFolder[];
  folderMap: Record<string, FolderMapEntry>;
}

/** Full provisioning result (all states complete). */
export interface ProvisionResult {
  sharedDriveId: string;
  sharedDriveName: string;
  folders: ProvisionedFolder[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Determine if a Drive API error is retryable (propagation-related).
 * Only retry on "File not found" (404) or permission errors (403)
 * that occur immediately after adding SA membership.
 * Do NOT retry on permanent failures (invalid parent, malformed request, auth scope errors).
 */
function isRetryableError(err: unknown): boolean {
  const error = err as { code?: number; status?: number; message?: string };
  const code = error.code || error.status;
  if (code && RETRYABLE_STATUS_CODES.includes(code)) {
    return true;
  }
  // Also catch "File not found" in error message for wrapped errors
  const msg = error.message || '';
  if (msg.includes('File not found') || msg.includes('notFound')) {
    return true;
  }
  return false;
}

/**
 * Create a single folder inside a Shared Drive, with retry for propagation delays.
 *
 * Uses the regular (non-impersonated) Drive client — the SA is already a
 * Content Manager on the Shared Drive at this point.
 */
async function createFolderWithRetry(
  name: string,
  parentId: string
): Promise<string> {
  const drive = await getDriveClientAsSA();

  for (let attempt = 1; attempt <= FOLDER_CREATE_MAX_RETRIES; attempt++) {
    try {
      const response = await drive.files.create({
        supportsAllDrives: true,
        requestBody: {
          name,
          mimeType: DRIVE_FOLDER_MIME_TYPE,
          parents: [parentId],
        },
        fields: 'id',
      });

      const folderId = response.data.id;
      if (!folderId) {
        throw new Error(`Drive API returned no ID when creating folder "${name}"`);
      }

      if (attempt > 1) {
        console.log(`[drive/provision] Folder "${name}" created on attempt ${attempt}`);
      }
      return folderId;
    } catch (err) {
      if (attempt < FOLDER_CREATE_MAX_RETRIES && isRetryableError(err)) {
        console.log(
          `[drive/provision] Retryable error creating folder "${name}" (attempt ${attempt}/${FOLDER_CREATE_MAX_RETRIES}), ` +
          `waiting ${FOLDER_CREATE_RETRY_DELAY_MS}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, FOLDER_CREATE_RETRY_DELAY_MS));
        continue;
      }
      // Permanent failure or max retries exhausted
      throw err;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error(`Failed to create folder "${name}" after ${FOLDER_CREATE_MAX_RETRIES} attempts`);
}

/**
 * Create folders from a flat DocumentFolderItem[] list, respecting parent/child
 * relationships via parentCategory. Builds both the ProvisionedFolder[] list
 * and the folderMap (keyed by Drive folder ID).
 *
 * Container folders (isContainer: true) are created in Drive for structure but
 * are NOT included in the folderMap (files cannot be placed in containers).
 */
async function createFoldersFromManagedList(
  items: DocumentFolderItem[],
  sharedDriveId: string,
  results: ProvisionedFolder[],
  folderMap: Record<string, FolderMapEntry>
): Promise<void> {
  // Map folderCategory → created Drive folder ID (for parent lookups)
  const categoryToFolderId: Record<string, string> = {};

  // Process root-level folders first, then children
  const rootItems = items.filter((i) => !i.parentCategory);
  const childItems = items.filter((i) => i.parentCategory);

  // Create root-level folders
  for (const item of rootItems) {
    const folderId = await createFolderWithRetry(item.name, sharedDriveId);
    categoryToFolderId[item.folderCategory] = folderId;

    results.push({
      name: item.name,
      folderId,
      parentId: sharedDriveId,
      visibility: item.isContainer ? 'client-visible' : item.visibility,
    });

    // Only non-container folders go in the folderMap
    if (!item.isContainer) {
      folderMap[folderId] = {
        folderCategory: item.folderCategory,
        name: item.name,
      };
    }
  }

  // Create child folders (e.g., Scripts → Client Approved, Internal Working)
  for (const item of childItems) {
    const parentFolderId = categoryToFolderId[item.parentCategory!];
    if (!parentFolderId) {
      console.error(
        `[drive/provision] Cannot create folder "${item.name}" — ` +
        `parent category "${item.parentCategory}" not found. Skipping.`
      );
      continue;
    }

    const folderId = await createFolderWithRetry(item.name, parentFolderId);
    categoryToFolderId[item.folderCategory] = folderId;

    results.push({
      name: item.name,
      folderId,
      parentId: parentFolderId,
      visibility: item.isContainer ? 'client-visible' : item.visibility,
    });

    // Only non-container folders go in the folderMap
    if (!item.isContainer) {
      folderMap[folderId] = {
        folderCategory: item.folderCategory,
        name: item.name,
      };
    }
  }
}

// ─── Public API: State Machine Steps ──────────────────────────────────────────

/**
 * States A + B: Create Shared Drive and add SA as Content Manager.
 *
 * After this function returns, the caller MUST persist the driveId to
 * Firestore (State C) before proceeding to folder creation.
 *
 * @param clientId - Client Firestore doc ID (used in requestId)
 * @param clientName - Client display name (used in Shared Drive name)
 * @returns SharedDriveCreationResult with the new driveId
 */
export async function createSharedDrive(
  clientId: string,
  clientName: string
): Promise<SharedDriveCreationResult> {
  // ── State A: Create the Shared Drive via impersonated client ────────────
  const impersonatedDrive = await getDriveClientWithImpersonation();
  const sharedDriveName = `${clientName} (Client)`;

  console.log(`[drive/provision] State A: Creating Shared Drive "${sharedDriveName}"...`);

  const sharedDriveResponse = await impersonatedDrive.drives.create({
    requestId: `exchange-${clientId}-${Date.now()}`,
    requestBody: {
      name: sharedDriveName,
    },
  });

  const sharedDriveId = sharedDriveResponse.data.id;
  if (!sharedDriveId) {
    throw new Error('Drive API returned no ID when creating Shared Drive');
  }

  console.log(`[drive/provision] State A complete: driveId=${sharedDriveId}`);

  // ── State B: Add SA as Content Manager (organizer) ──────────────────────
  const saEmail = await getSAEmail();

  console.log(`[drive/provision] State B: Adding SA ${saEmail} as Content Manager...`);

  await impersonatedDrive.permissions.create({
    fileId: sharedDriveId,
    supportsAllDrives: true,
    requestBody: {
      type: 'user',
      role: 'organizer', // Content Manager = organizer in the API
      emailAddress: saEmail,
    },
  });

  console.log('[drive/provision] State B complete: SA added as Content Manager');

  return { sharedDriveId, sharedDriveName };
}

/**
 * State D: Create the canonical folder tree inside an existing Shared Drive.
 *
 * Handles permission propagation delays with retry logic.
 * The SA must already be a Content Manager on the Shared Drive.
 *
 * @param sharedDriveId - The Shared Drive to create folders in
 * @param folderTemplate - Active folder items from the Document Folders managed list
 * @returns FolderCreationResult with all created folders and folderMap
 */
export async function createFolderTree(
  sharedDriveId: string,
  folderTemplate: DocumentFolderItem[]
): Promise<FolderCreationResult> {
  console.log(`[drive/provision] State D: Creating folder tree in drive ${sharedDriveId}...`);

  // ── Diagnostic: verify SA can see the Shared Drive before creating folders ──
  const drive = await getDriveClientAsSA();
  const saEmail = await getSAEmail();
  console.log(`[drive/provision] Diagnostic: SA identity for folder ops: ${saEmail}`);

  try {
    const driveInfo = await drive.drives.get({
      driveId: sharedDriveId,
      fields: 'id,name',
    });
    console.log(`[drive/provision] Diagnostic: drives.get OK — name="${driveInfo.data.name}", id=${driveInfo.data.id}`);
  } catch (diagErr) {
    const err = diagErr as { code?: number; message?: string };
    console.error(`[drive/provision] Diagnostic: drives.get FAILED — code=${err.code}, message=${err.message}`);
    console.error(`[drive/provision] This means the SA (${saEmail}) cannot see the Shared Drive at all.`);
    throw new Error(
      `SA ${saEmail} cannot access Shared Drive ${sharedDriveId} via drives.get. ` +
      `The SA may not be a member, or there is an identity mismatch. Error: ${err.message}`
    );
  }

  try {
    const listing = await drive.files.list({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'drive',
      driveId: sharedDriveId,
      q: 'trashed = false',
      fields: 'files(id,name,parents)',
    });
    console.log(`[drive/provision] Diagnostic: files.list OK — ${listing.data.files?.length || 0} existing items`);
  } catch (diagErr) {
    const err = diagErr as { code?: number; message?: string };
    console.error(`[drive/provision] Diagnostic: files.list FAILED — code=${err.code}, message=${err.message}`);
    // Don't fail here — the drives.get passed, so folder creation may still work
  }

  const folders: ProvisionedFolder[] = [];
  const folderMap: Record<string, FolderMapEntry> = {};
  await createFoldersFromManagedList(folderTemplate, sharedDriveId, folders, folderMap);

  console.log(
    `[drive/provision] State D complete: ${folders.length} folders created, ` +
    `${Object.keys(folderMap).length} entries in folderMap`
  );

  return { folders, folderMap };
}
