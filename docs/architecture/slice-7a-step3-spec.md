# Angsana Exchange — Slice 7A Step 3: File Download & Upload Streaming Routes

**Date:** 7 April 2026
**Status:** Implemented
**Depends on:** Slice 7A Steps 1–2 (complete)
**Scope:** Download + upload API routes — no UI, no Firestore registry

## Purpose

Two API routes: download a file from Drive through Exchange, and upload a file to Drive through Exchange. Files flow through Exchange's API — no direct Drive URLs are ever exposed to callers.

## What This Step Does NOT Do

- No UI pages or components
- No Firestore document registry (metadata per file)
- No visibility filtering (client-visible vs internal-only)
- No file deletion, rename, or move
- No Google Docs/Sheets/Slides native editing

## Files

| File | Purpose |
|------|---------|
| `src/lib/drive/download.ts` | `downloadDriveFile()` + `getFileMetadataWithParents()` — streaming download/export |
| `src/lib/drive/upload.ts` | `uploadToDrive()` — upload file to Drive folder |
| `src/app/api/clients/[clientId]/documents/download/[fileId]/route.ts` | GET download route |
| `src/app/api/clients/[clientId]/documents/upload/route.ts` | POST upload route |

## API

### GET /api/clients/{clientId}/documents/download/{fileId}

- **Auth:** internal-admin and internal-user only (403 for client roles)
- Streams file content with `Content-Type`, `Content-Disposition`, `Content-Length` headers
- Binary files: streamed directly from Drive
- Google Workspace files: exported (Docs→PDF, Sheets→xlsx, Slides→PDF)
- File validation: verifies file's parent folder is within client's Drive tree

### POST /api/clients/{clientId}/documents/upload

- **Auth:** internal-admin and internal-user only (403 for client roles)
- **Content-Type:** multipart/form-data
- **Form fields:** `file` (required), `folderId` (required — must be in client's tree)
- **Max file size:** 50MB (413 if exceeded)
- Returns 201 with created file metadata

## Google Workspace Export Mappings

| Drive MIME Type | Export As | Extension |
|----------------|-----------|-----------|
| Google Docs | application/pdf | .pdf |
| Google Sheets | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | .xlsx |
| Google Slides | application/pdf | .pdf |

## Security

- Both routes verify file/folder is within the client's Drive tree
- Downloads: get file's parent folder ID, validate parent is in tree
- Uploads: validate target folderId is in tree (same as browse)
- Streaming downloads avoid buffering entire files in memory (Cloud Run 512Mi)
- Upload buffers in memory (acceptable for ≤50MB on 512Mi)

## Roadmap Context

- **Step 1** (complete): Drive API connectivity and browse endpoint
- **Step 2** (complete): Folder provisioning
- **Step 3** (this step): File download and upload
- **Step 4**: Firestore document registry — metadata per file
- **Step 5**: Documents UI for internal users
- **Step 6**: Client document view
