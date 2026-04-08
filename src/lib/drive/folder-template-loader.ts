// =============================================================================
// Angsana Exchange — Document Folder Template Loader
// Slice 7A Step 4: Document Registry
//
// Loads the canonical folder template from Firestore managed list
// (tenants/{tenantId}/managedLists/documentFolders) instead of the
// hardcoded CANONICAL_FOLDER_TEMPLATE constant.
//
// Used by: provisioning route, upload route, browse route, register route.
// =============================================================================

import { adminDb } from '@/lib/firebase/admin';
import type { DocumentFolderItem } from '@/types';

/**
 * Load the document folder template from the Firestore managed list.
 *
 * @param tenantId - The tenant ID (defaults to 'angsana')
 * @returns Array of DocumentFolderItem entries, sorted by sortOrder
 * @throws Error if the managed list document doesn't exist
 */
export async function getDocumentFolderTemplate(
  tenantId: string = 'angsana'
): Promise<DocumentFolderItem[]> {
  const doc = await adminDb
    .collection('tenants')
    .doc(tenantId)
    .collection('managedLists')
    .doc('documentFolders')
    .get();

  if (!doc.exists) {
    throw new Error(
      `Document folder template not found at tenants/${tenantId}/managedLists/documentFolders. ` +
      `Run the seed script first.`
    );
  }

  const data = doc.data();
  const items = (data?.items || []) as DocumentFolderItem[];

  if (items.length === 0) {
    throw new Error(
      `Document folder template at tenants/${tenantId}/managedLists/documentFolders exists ` +
      `but contains no items. This would create a Shared Drive with no folders. ` +
      `Check the seed data.`
    );
  }

  // Return sorted by sortOrder
  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get only the active, non-container folders — the folders that should
 * actually receive files. Used by upload validation and browse filtering.
 *
 * @param tenantId - The tenant ID (defaults to 'angsana')
 * @returns Array of active, non-container DocumentFolderItem entries
 */
export async function getActiveFileableFolders(
  tenantId: string = 'angsana'
): Promise<DocumentFolderItem[]> {
  const all = await getDocumentFolderTemplate(tenantId);
  return all.filter((f) => f.active && !f.isContainer);
}

/**
 * Get only the active folders for provisioning — includes containers
 * (they need to be created in Drive) but excludes inactive folders.
 *
 * @param tenantId - The tenant ID (defaults to 'angsana')
 * @returns Array of active DocumentFolderItem entries (including containers)
 */
export async function getActiveFoldersForProvisioning(
  tenantId: string = 'angsana'
): Promise<DocumentFolderItem[]> {
  const all = await getDocumentFolderTemplate(tenantId);
  return all.filter((f) => f.active);
}
