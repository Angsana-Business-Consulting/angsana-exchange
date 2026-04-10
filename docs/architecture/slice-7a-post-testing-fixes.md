# Slice 7A Steps 5 & 6 — Post-Testing Fixes and Enhancements

## Priority: Fix all issues before moving to next slice

---

## Bug Fixes

### Fix 1: Slow initial render (3.75 seconds)

**Problem:** The Documents page takes nearly 4 seconds to render after the skeleton appears. The default "All folders" grouped view likely triggers multiple Drive API calls (one per folder for the `includeUnregisteredCheck`) sequentially.

**Fix:** 
- The default grouped view should NOT check for unregistered content. Only check when the user clicks into a specific folder.
- On initial load, fetch documents from Firestore only (fast). The `includeUnregisteredCheck` should be `false` by default.
- Only set `includeUnregisteredCheck=true` when a specific folder is selected in the tree (single folder, single check).
- Consider caching the folder contents on the client after first fetch so switching between folders doesn't re-fetch.

### Fix 2: Click opens preview instead of edit

**Problem:** When an internal user clicks a file name, it opens the Google Drive preview (`/view`) instead of the editor (`/edit`). The spec requires internal users to go directly to the editor.

**Fix:** Check `getGoogleEditorUrl()` in `src/lib/documents/utils.ts`. For Google Workspace mimeTypes, the URL should end in `/edit`:
- `application/vnd.google-apps.document` → `https://docs.google.com/document/d/{driveFileId}/edit`
- `application/vnd.google-apps.spreadsheet` → `https://docs.google.com/spreadsheets/d/{driveFileId}/edit`
- `application/vnd.google-apps.presentation` → `https://docs.google.com/presentation/d/{driveFileId}/edit`

For non-Google files (PDF, docx, xlsx uploads), `/view` is correct since there's no native editor. But for Workspace files, it must be `/edit`.

### Fix 3: Upload to renamed folder says "folder not provisioned"

**Problem:** The managed list entry `scripts-internal-working` was renamed to `scripts-internal-only` in Firestore (both the `folderCategory` key and display name). But the client's `folderMap` was written at provisioning time with the original key `scripts-internal-working`. The upload code looks for the new key in the folderMap and doesn't find it.

**Fix:** The `folderCategory` key is meant to be immutable — it's an identifier, not a display label. Restore the `folderCategory` to `scripts-internal-working` in the managed list. Only the `name` field should be changed (to "Internal Only" or whatever the desired display name is).

**Also:** Add a note in the admin Managed Lists UI (Document Folders tab) that the folderCategory key is read-only after creation. The edit form should show the key as a disabled/greyed field with a note: "Category key cannot be changed after creation."

### Fix 4: Unregistered files detection is broken

**Problem:** Two issues observed:
1. The seed file `test-shared.txt` shows as both registered AND flagged as unregistered in the same folder. The comparison logic isn't matching the registered Firestore entry against the Drive listing correctly (likely a `driveFileId` mismatch between what was seeded and what Drive returns).
2. A Google Doc created directly in Drive doesn't appear in the unregistered file list. The Drive browse may not be finding it (folder ID mismatch, or the file is in the Shared Drive root rather than the expected subfolder).

**Fix:**
- Debug the comparison logic in the browse endpoint when `includeUnregisteredCheck=true`. Compare the `driveFileId` values between Firestore registry entries and Drive API results. Log both sets for the Targeting folder to see where the mismatch is.
- For the Google Doc not appearing: verify the file is actually in the correct Drive folder (not the Shared Drive root). Check if the Drive API listing includes Google Workspace native files alongside uploaded files.

### Fix 5: Scripts container folder shows flat file list

**Problem:** Clicking "Scripts" in the folder tree shows the full file list as if it's a regular folder. Since Scripts is a container folder (`isContainer: true`), clicking it should expand to show its children (Client Approved, Internal Only) rather than displaying files.

**Fix:**
- Clicking a container folder in the tree should toggle expand/collapse of its children. It should NOT select the container as the active folder.
- The container folder should not trigger a browse API call.
- If the container is collapsed, clicking it expands to show children. If expanded, clicking it collapses.
- Files that live directly in the container folder in Drive (if any) should not be displayed — files should only be in leaf folders.

### Fix 6: `uploadedByName` showing UID instead of name

**Problem:** Screenshot shows "by zVt5CIYSpzNGsoFL18vFfjcqrY62" — a Firebase UID, not a display name. The `uploadedByName` field was added to the upload route but the seed data and previously uploaded test files don't have it.

**Fix:**
- Verify that new uploads via the UI correctly populate `uploadedByName` from the user context. The user context should have `displayName` or `email` available.
- For the browse response: if `uploadedByName` is missing (old data), fall back to showing nothing or "Unknown" rather than the raw UID.
- The seed data file `test-shared.txt` predates this field — either update the seed script to include `uploadedByName` or accept it shows "Unknown" for legacy entries.

---

## New Features (This Round)

### Feature 1: "New document" button for internal users

**Problem:** Internal users currently have no way to create a new Google Doc/Sheet/Slides from within Exchange. They have to go to Drive, create the file in the right folder, then come back to Exchange to register it. Too much friction.

**Implementation:**

**API route:** `POST /api/clients/{clientId}/documents/create`
- Request body: `{ folderCategory: string, name: string, type: "document" | "spreadsheet" | "presentation" }`
- Internal users only (internal-admin, internal-user)
- Flow:
  1. Resolve folderCategory to folderId via client's folderMap
  2. Create empty Google Workspace file in the target Drive folder using Drive API `files.create` with appropriate mimeType:
     - "document" → `application/vnd.google-apps.document`
     - "spreadsheet" → `application/vnd.google-apps.spreadsheet`
     - "presentation" → `application/vnd.google-apps.presentation`
  3. Create Firestore registry entry (same schema as upload, `registrySource: "exchange_create"`)
  4. Return the registry entry including `driveFileId`
- Use `getDriveClientAsSA()` for the Drive API call (same as upload)

**UI:**
- When a non-container folder is selected AND user is internal, show a "New" dropdown button next to "Upload"
- Dropdown options: "Google Doc", "Google Sheet", "Google Slides"
- On selection: prompt for file name (inline input or small dialog), then call the create API
- On success: new file appears in list, AND automatically opens in Google editor in a new tab

### Feature 2: Move file to folder

**API route:** `PATCH /api/clients/{clientId}/documents/{documentId}/move`
- Request body: `{ folderCategory: string }`
- Internal users only
- Flow:
  1. Get the current registry entry from Firestore
  2. Resolve target folderCategory to folderId via client's folderMap
  3. Move file in Drive: `files.update` with `addParents: newFolderId, removeParents: oldFolderId`
  4. Update Firestore registry: `folderCategory`, `folderId`, `visibility` (inherits from target folder)
  5. Return updated registry entry

**UI:**
- Add "Move to..." option in three-dot menu (internal users only), positioned after "Rename"
- Opens a dropdown/popover showing all non-container folders from the documentFolders managed list
- Current folder shown as disabled/greyed
- On selection: call move API, update list (file disappears from current folder view, appears in target)
- Optimistic UI: remove from list immediately, revert on error

### Feature 3: Document preview (Part A)

**Scope:** Preview for PDFs, images, and Google Workspace files (exported as PDF for client users). See separate spec `backlog-document-preview-part-a.md` for full details.

**Summary of implementation:**

**No new API endpoints needed.** Uses existing download endpoint for client users and Google preview URLs for internal users.

**Helper functions** (add to `src/lib/documents/utils.ts`):
- `isPreviewable(mimeType: string, isInternal: boolean): boolean`
- `getPreviewAction(driveFileId: string, mimeType: string, isInternal: boolean, clientId: string)` — returns `{ type: "google_preview", url: string }` or `{ type: "modal", url: string, contentType: "pdf" | "image" }` or `null`

**UI — three-dot menu:**
- Add "Preview" menu item. Position: after "Open in Google" for internal, first item for client users. Only show if `isPreviewable()` returns true.
- Internal users + Google Workspace files → opens Google preview URL (`/preview` not `/edit`) in new tab
- Internal users + PDF/image → opens preview modal
- Client users + Google Docs/Slides → opens preview modal (downloads as PDF via Exchange endpoint, renders in `<object>`)
- Client users + PDF/image → opens preview modal
- Client users + Google Sheets → no preview (exports as xlsx, not renderable). Hide Preview menu item.

**UI — preview modal component** (`src/components/documents/PreviewModal.tsx`):
- Dark semi-transparent backdrop with click-to-close
- Modal: max-width 900px, max-height 80vh, white background, rounded corners, close X button
- Title bar: file name
- Content: `<object>` tag for PDFs, `<img>` tag for images
- Footer: "Download" button as fallback
- Loading spinner while content streams

### Feature 4: Convert uploaded files to Google format (internal uploads only)

**Problem:** When an internal user uploads a .docx, it stays as a .docx in Drive. Internal users then can't edit it natively in Google Docs — they get the compatibility mode experience.

**Fix:** In the upload route (`upload/route.ts`), when the uploader is an internal user AND the file is a convertible type, add `convert: true` to the Drive API `files.create` call. This tells Google Drive to convert the upload to native Google format:
- .docx → Google Docs
- .xlsx → Google Sheets
- .pptx → Google Slides
- .csv → Google Sheets

For client-approver uploads, do NOT convert. Keep the original format. Clients download files anyway, so the original format is better.

After conversion, the Firestore registry entry should store the resulting Google mimeType (not the original upload mimeType), since that's what the file actually is in Drive.

---

## Implementation Order

1. **Fix 2** (click opens edit not preview) — 10 minutes
2. **Fix 3** (restore folderCategory key, add read-only guard in admin UI) — 30 minutes
3. **Fix 6** (uploadedByName fallback) — 15 minutes
4. **Fix 5** (Scripts container folder toggle) — 30 minutes
5. **Fix 1** (slow render — defer unregistered check) — 1 hour
6. **Fix 4** (unregistered files detection) — 1 hour (debugging)
7. **Feature 4** (convert internal uploads to Google format) — 30 minutes
8. **Feature 1** (New document button) — 2 hours
9. **Feature 2** (Move file to folder) — 1.5 hours
10. **Feature 3** (Preview Part A) — 3 hours

Total estimated: ~1 day

---

## Definition of Done (Additional ACs)

- **AC11:** Documents page loads in under 1 second for the default grouped view. Unregistered check only fires when a specific folder is selected.
- **AC12:** Internal user clicking a Google Workspace file name opens `/edit` URL in new tab, not `/view`.
- **AC13:** Clicking a container folder (Scripts) toggles expand/collapse of children. Does not select it or trigger a browse.
- **AC14:** Internal user sees "New" dropdown (Doc/Sheet/Slides) next to Upload. Creating a file adds it to the registry and opens it in Google editor.
- **AC15:** Internal user can "Move to..." a file via three-dot menu. File moves in Drive and Firestore. Visibility updates to match target folder.
- **AC16:** Preview works for PDFs and images (modal). Google Workspace preview opens Google preview URL for internal users or exports-as-PDF modal for client users.
- **AC17:** Internal user uploads of .docx/.xlsx/.pptx are auto-converted to Google format. Client uploads retain original format.
- **AC18:** Files uploaded before `uploadedByName` was added show gracefully (no raw UIDs).
