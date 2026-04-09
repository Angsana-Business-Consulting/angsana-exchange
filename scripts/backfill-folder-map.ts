#!/usr/bin/env npx tsx
/**
 * Angsana Exchange — Backfill Folder Map Script
 * Slice 7A Step 4, Step 9: One-off backfill for existing provisioned clients
 *
 * For clients that were provisioned before Step 4 (i.e., they have a driveId
 * and folders in Drive but no folderMap in Firestore), this script:
 *
 *   1. Reads the client's config to get the driveId
 *   2. Loads the Document Folders managed list (canonical template)
 *   3. Lists all folders in the client's Shared Drive
 *   4. Matches Drive folders to the template by name (case-insensitive)
 *   5. Builds a folderMap and writes it to the client's config
 *   6. Sets folderProvisionStatus = 'complete' if not already set
 *
 * Usage:
 *   npx tsx scripts/backfill-folder-map.ts <clientId>
 *   npx tsx scripts/backfill-folder-map.ts cegid-spain
 *   npx tsx scripts/backfill-folder-map.ts --dry-run cegid-spain
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS set to the firebase-adminsdk SA key file
 *   - Target project: angsana-exchange
 *   - Client must already have a provisioned Shared Drive (driveId in config)
 *   - Document Folders managed list must be seeded (run seed.ts first)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import * as fs from 'fs';
import type { DocumentFolderItem, FolderMapEntry } from '../src/types';

// =============================================================================
// Configuration
// =============================================================================

const PROJECT_ID = 'angsana-exchange';
const TENANT_ID = 'angsana';

// =============================================================================
// Firebase Admin initialisation
// =============================================================================

function initAdmin() {
  if (getApps().length > 0) return;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('  Using GOOGLE_APPLICATION_CREDENTIALS');
    initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      projectId: PROJECT_ID,
    });
  } else {
    console.log('  Using Application Default Credentials');
    initializeApp({ projectId: PROJECT_ID });
  }
}

// =============================================================================
// Drive API client (same pattern as src/lib/drive/client.ts)
// =============================================================================

function getDriveClient() {
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFilePath) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS must be set to the firebase-adminsdk SA key file'
    );
  }

  const raw = fs.readFileSync(keyFilePath, 'utf-8');
  const parsed = JSON.parse(raw);

  const auth = new google.auth.JWT({
    email: parsed.client_email,
    key: parsed.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

// =============================================================================
// Core logic
// =============================================================================

interface DriveFolderInfo {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * List all folders in a Shared Drive (recursive, up to 5 levels).
 */
async function listAllFolders(
  driveId: string
): Promise<DriveFolderInfo[]> {
  const drive = getDriveClient();
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  const allFolders: DriveFolderInfo[] = [];

  // BFS from root
  let currentLevel = [driveId];

  for (let depth = 0; depth < 5; depth++) {
    if (currentLevel.length === 0) break;
    const nextLevel: string[] = [];

    for (const parentId of currentLevel) {
      const response = await drive.files.list({
        q: `'${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
        fields: 'files(id, name, parents)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'drive',
        driveId,
      });

      const folders = response.data.files || [];
      for (const folder of folders) {
        if (folder.id && folder.name) {
          allFolders.push({
            id: folder.id,
            name: folder.name,
            parentId,
          });
          nextLevel.push(folder.id);
        }
      }
    }

    currentLevel = nextLevel;
  }

  return allFolders;
}

/**
 * Match Drive folders to the canonical template by name.
 * Returns a folderMap keyed by Drive folder ID.
 */
function matchFoldersToTemplate(
  driveFolders: DriveFolderInfo[],
  template: DocumentFolderItem[]
): { folderMap: Record<string, FolderMapEntry>; unmatched: DriveFolderInfo[] } {
  const folderMap: Record<string, FolderMapEntry> = {};
  const matched = new Set<string>();

  // Build a name→template lookup (case-insensitive)
  const templateByName = new Map<string, DocumentFolderItem>();
  for (const item of template) {
    templateByName.set(item.name.toLowerCase(), item);
  }

  for (const folder of driveFolders) {
    const templateItem = templateByName.get(folder.name.toLowerCase());
    if (templateItem && !templateItem.isContainer) {
      folderMap[folder.id] = {
        folderCategory: templateItem.folderCategory,
        name: templateItem.name,
      };
      matched.add(folder.id);
    }
  }

  const unmatched = driveFolders.filter((f) => !matched.has(f.id));
  return { folderMap, unmatched };
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const clientId = args.filter((a) => !a.startsWith('--'))[0];

  if (!clientId) {
    console.error('');
    console.error('Usage: npx tsx scripts/backfill-folder-map.ts [--dry-run] <clientId>');
    console.error('');
    process.exit(1);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Angsana Exchange — Backfill Folder Map      ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  if (dryRun) {
    console.log('  ⚠️  DRY RUN — no changes will be written');
    console.log('');
  }

  console.log('→ Initialising Firebase Admin...');
  initAdmin();
  const db = getFirestore();
  console.log('');

  // ── 1. Read client config ─────────────────────────────────────────────────
  console.log(`→ Reading client config for "${clientId}"...`);
  const configRef = db
    .collection('tenants')
    .doc(TENANT_ID)
    .collection('clients')
    .doc(clientId);

  const configDoc = await configRef.get();
  if (!configDoc.exists) {
    console.error(`  ✗ Client "${clientId}" not found in Firestore`);
    process.exit(1);
  }

  const configData = configDoc.data()!;
  const driveId = configData.driveId as string | undefined;
  const existingFolderMap = configData.folderMap as Record<string, FolderMapEntry> | undefined;

  if (!driveId) {
    // Check for legacy driveFolderId
    if (configData.driveFolderId) {
      console.error(`  ✗ Client "${clientId}" uses legacy driveFolderId — backfill not applicable`);
      console.error('    Legacy clients need manual migration to Shared Drives first.');
    } else {
      console.error(`  ✗ Client "${clientId}" has no driveId — provision the client first`);
    }
    process.exit(1);
  }

  if (existingFolderMap && Object.keys(existingFolderMap).length > 0) {
    console.log(`  ⚠️  Client already has a folderMap with ${Object.keys(existingFolderMap).length} entries`);
    console.log('    Existing folderMap will be overwritten.');
    console.log('');
  }

  console.log(`  driveId: ${driveId}`);
  console.log(`  name: ${configData.name}`);
  console.log(`  folderProvisionStatus: ${configData.folderProvisionStatus || '(not set)'}`);
  console.log('');

  // ── 2. Load Document Folders managed list ─────────────────────────────────
  console.log('→ Loading Document Folders managed list...');
  const templateDoc = await db
    .collection('tenants')
    .doc(TENANT_ID)
    .collection('managedLists')
    .doc('documentFolders')
    .get();

  if (!templateDoc.exists) {
    console.error('  ✗ Document Folders managed list not found — run seed.ts first');
    process.exit(1);
  }

  const templateData = templateDoc.data();
  const template = (templateData?.items || []) as DocumentFolderItem[];
  const fileableTemplate = template.filter((f) => f.active && !f.isContainer);

  console.log(`  ${template.length} total entries, ${fileableTemplate.length} fileable (non-container, active)`);
  console.log('');

  // ── 3. List all folders in the Shared Drive ───────────────────────────────
  console.log(`→ Listing folders in Shared Drive ${driveId}...`);
  const driveFolders = await listAllFolders(driveId);
  console.log(`  Found ${driveFolders.length} folders in Drive`);

  for (const folder of driveFolders) {
    console.log(`    📁 ${folder.name} (${folder.id})`);
  }
  console.log('');

  // ── 4. Match Drive folders to template ────────────────────────────────────
  console.log('→ Matching folders to canonical template...');
  const { folderMap, unmatched } = matchFoldersToTemplate(driveFolders, fileableTemplate);

  console.log(`  ✓ ${Object.keys(folderMap).length} folders matched`);
  for (const [folderId, entry] of Object.entries(folderMap)) {
    console.log(`    ${entry.folderCategory.padEnd(30)} → ${folderId} (${entry.name})`);
  }

  if (unmatched.length > 0) {
    console.log('');
    console.log(`  ⚠️  ${unmatched.length} folders not matched (containers or custom folders):`);
    for (const folder of unmatched) {
      console.log(`    ❓ ${folder.name} (${folder.id})`);
    }
  }

  // Check for template entries with no matching folder
  const matchedCategories = new Set(Object.values(folderMap).map((e) => e.folderCategory));
  const missingCategories = fileableTemplate.filter((f) => !matchedCategories.has(f.folderCategory));
  if (missingCategories.length > 0) {
    console.log('');
    console.log(`  ⚠️  ${missingCategories.length} template entries have no matching Drive folder:`);
    for (const item of missingCategories) {
      console.log(`    ❌ ${item.folderCategory} ("${item.name}")`);
    }
  }
  console.log('');

  // ── 5. Write folderMap to Firestore ───────────────────────────────────────
  if (Object.keys(folderMap).length === 0) {
    console.error('  ✗ No folders matched — cannot write empty folderMap');
    console.error('    Check that the Drive folder names match the template names.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('→ DRY RUN — would write the following to Firestore:');
    console.log(JSON.stringify({ folderMap, folderProvisionStatus: 'complete' }, null, 2));
    console.log('');
    console.log('✅ Dry run complete. Re-run without --dry-run to apply.');
  } else {
    console.log('→ Writing folderMap to Firestore...');
    await configRef.update({
      folderMap,
      folderProvisionStatus: 'complete',
      folderMapBackfilledAt: FieldValue.serverTimestamp(),
      folderMapBackfilledBy: 'backfill-folder-map-script',
    });
    console.log('  ✓ folderMap written to client config');
    console.log('  ✓ folderProvisionStatus set to "complete"');
    console.log('');
    console.log('✅ Backfill complete!');
  }

  console.log('');
}

main().catch((err) => {
  console.error('');
  console.error('❌ Backfill failed:', err.message || err);
  console.error('');
  if (err.message?.includes('Could not load the default credentials')) {
    console.error('Hint: Set GOOGLE_APPLICATION_CREDENTIALS to the firebase-adminsdk SA key file.');
  }
  process.exit(1);
});
