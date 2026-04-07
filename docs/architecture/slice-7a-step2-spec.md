# Angsana Exchange — Slice 7A Step 2: Folder Provisioning Endpoint

**Date:** 7 April 2026
**Status:** Implemented
**Depends on:** Slice 7A Step 1 (complete)
**Scope:** Folder provisioning API only — no UI

## Purpose

This step builds the API endpoint that creates the canonical Drive folder tree for a client. The service account creates the folders in Google Drive and stores the root folder ID on the client's Firestore config document.

## What This Step Does NOT Do

- No UI pages or components
- No file upload or download
- No Firestore document registry (metadata per file)
- No folder deletion endpoint
- No integration with the Slice 6B client provisioning endpoint (that comes later)
- No approval workflow

## Canonical Folder Structure

Every new client gets this folder tree:

| Folder | Visibility | Purpose |
|--------|-----------|---------|
| Targeting | Client-visible | ICP research, target list source documents |
| TLM Ready Material | Client-visible | Case studies, white papers, collateral |
| Client Material | Client-visible | Documents the client provides |
| Scripts | (parent) | Parent folder containing two subfolders |
| Scripts / Client Approved | Client-visible | Client-signed-off scripts |
| Scripts / Internal Working | Internal-only | AM's operational scripts |
| AI Source Documents | Client-visible | PDFs feeding the AI vector pipeline |

Visibility is recorded on the template for documentation and future use in Step 4. In this step, folders are simply created in Drive.

## Files

| File | Purpose |
|------|---------|
| `src/lib/drive/folder-template.ts` | Canonical folder structure constant (`CANONICAL_FOLDER_TEMPLATE`) |
| `src/lib/drive/provision.ts` | Standalone `provisionClientFolders()` function |
| `src/app/api/clients/[clientId]/documents/provision/route.ts` | POST provision API route |

## API

### POST /api/clients/{clientId}/documents/provision

- **Auth:** internal-admin only (403 for all other roles)
- **Body:** none (client name read from Firestore config)
- **201:** Returns `ProvisionResult` with `rootFolderId` and all folder details
- **409:** `ALREADY_PROVISIONED` — driveFolderId already set on client config
- **404:** `CLIENT_NOT_FOUND` — client config document doesn't exist
- **400:** `INVALID_CONFIG` — client config missing name field
- **500:** `DRIVE_API_ERROR` — Drive API call failed

### Firestore Changes

One field written to the client config document:
- `driveFolderId` — root folder ID in Google Drive
- `driveProvisionedAt` — timestamp of provisioning
- `driveProvisionedBy` — email of the admin who triggered provisioning

## Testing

Manual via curl. See spec document for full test plan (sections 8.1–8.8).

## Roadmap Context

- **Step 1** (complete): Drive API connectivity and browse endpoint
- **Step 2** (this step): Folder provisioning
- **Step 3**: File download and upload
- **Step 4**: Firestore document registry — metadata per file
- **Step 5**: Documents UI for internal users
- **Step 6**: Client document view
