// =============================================================================
// Angsana Exchange — Folder Visibility Utilities
// Slice 7A Step 4: Document Registry
//
// Pure functions that resolve folder visibility from the Document Folders
// managed list. No Firestore reads — the calling code passes the managed
// list data as a parameter.
// =============================================================================

import type { DocumentFolderItem, FolderVisibility, FolderMap, FolderMapEntry } from '@/types';

/**
 * Resolve the visibility for a given folderCategory.
 *
 * @param folderCategory - The canonical folder key (e.g. "targeting", "working")
 * @param folderTemplate - The Document Folders managed list items
 * @returns The visibility class: "client-visible" or "internal-only"
 * @throws Error if the folderCategory is not found in the template
 */
export function resolveFolderVisibility(
  folderCategory: string,
  folderTemplate: DocumentFolderItem[]
): FolderVisibility {
  const folder = folderTemplate.find((f) => f.folderCategory === folderCategory);
  if (!folder) {
    throw new Error(`Unknown folderCategory: "${folderCategory}". Not found in document folder template.`);
  }
  return folder.visibility;
}

/**
 * Get all folderCategory keys that are client-visible.
 *
 * @param folderTemplate - The Document Folders managed list items
 * @returns Array of folderCategory strings with "client-visible" visibility
 */
export function getClientVisibleCategories(folderTemplate: DocumentFolderItem[]): string[] {
  return folderTemplate
    .filter((f) => f.visibility === 'client-visible' && !f.isContainer)
    .map((f) => f.folderCategory);
}

/**
 * Get all folderCategory keys that are internal-only.
 *
 * @param folderTemplate - The Document Folders managed list items
 * @returns Array of folderCategory strings with "internal-only" visibility
 */
export function getInternalOnlyCategories(folderTemplate: DocumentFolderItem[]): string[] {
  return folderTemplate
    .filter((f) => f.visibility === 'internal-only' && !f.isContainer)
    .map((f) => f.folderCategory);
}

/**
 * Build a reverse lookup map: folderCategory → { folderId, name }.
 * Inverts the client's folderMap (which is folderId → { folderCategory, name }).
 *
 * @param folderMap - The client's folderMap from config
 * @returns Map from folderCategory to { folderId, name }
 */
export function getCategoryToFolderMap(
  folderMap: FolderMap
): Record<string, { folderId: string; name: string }> {
  const result: Record<string, { folderId: string; name: string }> = {};
  for (const [folderId, entry] of Object.entries(folderMap)) {
    result[entry.folderCategory] = { folderId, name: entry.name };
  }
  return result;
}

/**
 * Look up the folderCategory for a given Drive folder ID using the client's folderMap.
 *
 * @param folderId - The Google Drive folder ID
 * @param folderMap - The client's folderMap from config
 * @returns The FolderMapEntry or null if not found
 */
export function lookupFolderCategory(
  folderId: string,
  folderMap: FolderMap
): FolderMapEntry | null {
  return folderMap[folderId] || null;
}
