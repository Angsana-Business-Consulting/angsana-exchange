# Angsana Exchange — Slice 7A Step 2/3 Revision

## Shared Drive Model: Provision, Upload & Download

**Prepared by:** Keith  
**Date:** 7 April 2026  
**Status:** Implemented  
**Replaces:** Step 2 (folder provisioning) and fixes Step 3 (upload)  
**Depends on:** Step 1 (complete), domain-wide delegation (complete)

---

## 1. Why This Revision

The original Step 2 created client folders in the service account's own Drive. The original Step 3 upload failed because service accounts have no storage quota — they cannot create files in Drive.

The fix is to use Google Shared Drives (formerly Team Drives). Shared Drives are owned by the organisation, not by any individual. Storage quota is at the org level. The SA can create files freely as a member of the Shared Drive.

### 1.1 The Shared Drive Model

- Each client gets their own Shared Drive — named `{clientName} (Client)`
- The SA is added as a Content Manager on the Shared Drive
- The canonical folder tree is created inside the Shared Drive
- All file operations (browse, upload, download) work directly — no impersonation needed for file operations
- Client teardown: archive or delete the Shared Drive — everything gone in one action
- AMs can be added to the Shared Drive for direct Drive access during transition
- Creating a Shared Drive requires domain-wide delegation — the SA impersonates a Workspace user for this one operation only

## 2. Prerequisites (Completed by Keith)

- Google Drive API enabled on angsana-exchange GCP project
- Domain-wide delegation enabled on firebase-adminsdk-fbsvc SA
- SA Client ID `104001036429095716955` authorised in Google Workspace admin with scope `https://www.googleapis.com/auth/drive`
- Impersonation target user: `keith.new2@angsana-uk.com`

## 3. Implementation Summary

### 3.1 Drive Client Module (`src/lib/drive/client.ts`)

Two Drive clients with shared credential loading:

- **`getDriveClient()`** — SA acting as itself (Content Manager). Used for ALL operations except Shared Drive creation.
- **`getDriveClientWithImpersonation()`** — SA impersonating a Workspace user via JWT with `subject`. Used ONLY for `drives.create`.
- **`getSAEmail()`** — Returns the SA's email for adding itself as Content Manager.

Credentials are loaded once from `GOOGLE_APPLICATION_CREDENTIALS` and cached.

### 3.2 Provision Function (`src/lib/drive/provision.ts`)

`provisionClientFolders(clientId, clientName)` performs:
1. Creates Shared Drive via impersonated client with deterministic idempotency key `exchange-${clientId}`
2. Adds SA as Content Manager (organizer role) on the Shared Drive
3. Creates canonical folder tree using regular SA client

Returns `ProvisionResult` with `sharedDriveId`, `sharedDriveName`, and `folders[]`.

### 3.3 Client Config Field

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `driveFolderId` | `driveId` | Shared Drive ID for new clients |
| — | `driveProvisionedAt` | Timestamp |
| — | `driveProvisionedBy` | User who triggered provisioning |

**Backwards compatibility:** All routes check `driveId || driveFolderId` so legacy clients (e.g., Cegid Spain) continue working.

### 3.4 Shared Drive API Flags

All Drive API calls include:
- `supportsAllDrives: true`
- `includeItemsFromAllDrives: true`

Browse (`listFolderContents`) accepts an optional `sharedDriveId` parameter. When provided, sets `corpora: 'drive'` and `driveId` for proper Shared Drive root listing.

### 3.5 Provision Route Guard

The 409 guard checks both `driveId` AND `driveFolderId` to prevent re-provisioning clients set up via either method.

## 4. Environment Variable

| Variable | Value |
|----------|-------|
| `DRIVE_IMPERSONATION_EMAIL` | `keith.new2@angsana-uk.com` |

## 5. Files Changed

| File | Action | Change |
|------|--------|--------|
| `src/lib/drive/client.ts` | Rewritten | Shared credential loading, `getDriveClientWithImpersonation()`, `getSAEmail()` |
| `src/lib/drive/provision.ts` | Rewritten | Shared Drive creation + SA membership + folder tree |
| `src/lib/drive/browse.ts` | Updated | `sharedDriveId` param on `listFolderContents()`, `supportsAllDrives` on all calls |
| `src/lib/drive/upload.ts` | Updated | `supportsAllDrives` on `files.create` |
| `src/lib/drive/download.ts` | Updated | Comment on `files.export` Shared Drive compatibility |
| `src/lib/drive/folder-template.ts` | No change | Same canonical template |
| `.../documents/provision/route.ts` | Updated | `driveId` field, dual guard, passes `clientId` |
| `.../documents/browse/route.ts` | Updated | `driveId \|\| driveFolderId` fallback, passes `sharedDriveId` |
| `.../documents/upload/route.ts` | Updated | `driveId \|\| driveFolderId` fallback |
| `.../documents/download/[fileId]/route.ts` | Updated | `driveId \|\| driveFolderId` fallback |

## 6. Testing

See the original spec document for full test scripts (provision, idempotency, browse, upload, download, backwards compatibility with Cegid Spain).
