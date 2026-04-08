# Slice 7A — Step 4: Firestore Document Registry

> **Implementation Specification**  
> Prepared by: Keith + Claude  
> Date: April 2026  
> Status: In Progress  
> Depends on: Slice 7A Steps 1–3 (Drive API, Provisioning, Upload/Download)  
> Source: `angsana-exchange-slice-7a-step4.docx`

This file is the markdown conversion of the original spec document. See the `.docx` for the canonical version.

## Files Created / Modified in This Slice

### New Files
| File | Purpose |
|------|---------|
| `src/types/index.ts` | Extended with `DocumentFolderItem`, `DocumentRegistryEntry`, `FolderMap`, `FolderMapEntry`, `FolderVisibility`, `DocumentRegistrySource`, `DocumentStatus` types. `ActionSource.type` extended with `'wishlist' \| 'document_upload'`. `ManagedListName` extended with `'documentFolders'`. |
| `src/lib/api/middleware/user-context.ts` | Shared user context extraction: `getUserFromHeaders()`, `hasClientAccess()`, `isInternal()`, `isClientApprover()` |
| `src/lib/drive/visibility.ts` | Pure functions: `resolveFolderVisibility()`, `getClientVisibleCategories()`, `getInternalOnlyCategories()`, `getCategoryToFolderMap()`, `lookupFolderCategory()` |
| `src/lib/drive/folder-template-loader.ts` | `getDocumentFolderTemplate()`, `getActiveFileableFolders()`, `getActiveFoldersForProvisioning()` — reads from Firestore managed list |
| `src/app/api/clients/[clientId]/documents/[documentId]/rename/route.ts` | PATCH rename endpoint |
| `src/app/api/clients/[clientId]/documents/[documentId]/route.ts` | DELETE soft-delete endpoint |
| `src/app/api/clients/[clientId]/documents/[documentId]/campaign/route.ts` | PATCH campaign link endpoint |
| `src/app/api/clients/[clientId]/documents/register/route.ts` | POST register existing Drive file |
| `scripts/backfill-folder-map.ts` | One-off script for test-provision client |

### Modified Files
| File | Change |
|------|--------|
| `src/app/api/clients/[clientId]/documents/upload/route.ts` | Dual write: Drive + Firestore registry. Auto-action for client-approver uploads. |
| `src/app/api/clients/[clientId]/documents/browse/route.ts` | Firestore-first reads with role-based visibility filtering. |
| `src/app/api/clients/[clientId]/documents/download/[fileId]/route.ts` | Registry status check for managed clients. |
| `src/app/api/clients/[clientId]/documents/provision/route.ts` | Reads folder template from Firestore. Persists folderMap. |
| `src/lib/drive/provision.ts` | Uses `getActiveFoldersForProvisioning()` instead of hardcoded constant. |
| `scripts/seed.ts` | Seeds `documentFolders` managed list. |
| `src/app/(dashboard)/admin/managed-lists/ManagedListsClient.tsx` | Document Folders admin tab. |
| `firestore.indexes.json` | 5 composite indexes for documents sub-collection. |

## Implementation Progress

- [x] Step 1: Types — all new types added to `src/types/index.ts`
- [x] Step 2: Shared user context utility — `src/lib/api/middleware/user-context.ts`
- [x] Step 6: Visibility utilities — `src/lib/drive/visibility.ts`
- [x] Step 7: Folder template loader — `src/lib/drive/folder-template-loader.ts`
- [x] Step 3: Seed script — Add documentFolders managed list to seed.ts
- [x] Step 4: Document Folders admin tab — ManagedListsClient.tsx + page.tsx updated
- [x] Step 5: Document Folders API route — dedicated `/api/managed-lists/document-folders` with guardrails
- [ ] Step 8: Provisioning route update — Firestore template read, folderMap write
- [ ] Step 9: Backfill script — scripts/backfill-folder-map.ts
- [ ] Step 10: Upload route — dual write, registry entry, auto-action
- [ ] Step 11: Browse route — Firestore-first, role filtering, hasUnregisteredContent
- [ ] Step 12: Register route — POST register existing file
- [ ] Step 13: Rename route — PATCH
- [ ] Step 14: Soft-delete route — DELETE
- [ ] Step 15: Campaign link route — PATCH
- [ ] Step 16: Download route guard — registry status check
- [ ] Step 17: Firestore indexes — 5 composite indexes
