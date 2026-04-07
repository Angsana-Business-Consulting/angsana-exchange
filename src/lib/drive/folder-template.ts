// =============================================================================
// Angsana Exchange — Canonical Folder Template
// Slice 7A Step 2: Folder Provisioning
//
// Single source of truth for the folder structure Exchange creates for each
// client in Google Drive. Used by provisionClientFolders() to create the tree
// and will be used by Step 4 (Firestore document registry) to set default
// visibility when registering folders.
//
// To evolve the folder template: add/remove entries here. Future validation
// logic can compare a client's actual Drive tree against this constant.
// =============================================================================

/**
 * A single entry in the canonical folder template.
 *
 * @property name - Folder name as it appears in Google Drive
 * @property visibility - Whether the folder's contents are visible to client
 *   users. Not enforced in this step — used by Step 4 (document registry).
 * @property children - Optional nested subfolders
 */
export interface FolderTemplateEntry {
  name: string;
  visibility: 'client-visible' | 'internal-only';
  children?: FolderTemplateEntry[];
}

/**
 * The canonical folder structure for every client in Exchange.
 *
 * When a client is provisioned, this template drives the creation of the
 * Drive folder tree under a root folder named "{clientName} (Client)".
 */
export const CANONICAL_FOLDER_TEMPLATE: FolderTemplateEntry[] = [
  { name: 'Targeting', visibility: 'client-visible' },
  { name: 'TLM Ready Material', visibility: 'client-visible' },
  { name: 'Client Material', visibility: 'client-visible' },
  {
    name: 'Scripts',
    visibility: 'client-visible',
    children: [
      { name: 'Client Approved', visibility: 'client-visible' },
      { name: 'Internal Working', visibility: 'internal-only' },
    ],
  },
  { name: 'AI Source Documents', visibility: 'client-visible' },
];
