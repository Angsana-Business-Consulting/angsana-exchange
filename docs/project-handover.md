# Angsana Exchange — Handover for Next Conversation (v5)

## Current State (8 April 2026)

### What's Built and Deployed

Slices 1–6B are complete. Slice 7A Steps 1–3 (Google Drive integration) are complete and deployed.

- **URL**: https://exchange.angsana-uk.com
- **Break-glass URL**: https://angsana-exchange-33083036927.europe-west2.run.app
- **Health check**: https://exchange.angsana-uk.com/api/health

### Implemented Modules

| Slice | Module | Status |
|-------|--------|--------|
| 1 | Auth, Navigation, Client Context, Campaign List | ✅ Complete |
| 2 | Campaign Detail, Create, Edit, Managed Lists Admin | ✅ Complete |
| 2+ | Client Settings, Capabilities Pattern | ✅ Complete |
| 3 | Check-ins, Actions, Auto-action Generation | ✅ Complete |
| 4 | Wishlists, Portfolio Dashboard, My Clients | ✅ Complete |
| 5 | So Whats Library, Campaign So What Picker | ✅ Complete |
| 5.1 | Production Deployment (Cloud Run, Firebase Hosting, Custom Domain) | ✅ Complete |
| 6A | Exchange API Layer & Auth Infrastructure | ✅ Complete |
| 6B | User & Client Lifecycle, Team Page, Admin Users Page | ✅ Complete |
| 7A-1 | Drive API Connectivity & Browse Endpoint | ✅ Complete |
| 7A-2 | Shared Drive Provisioning (State Machine) | ✅ Complete |
| 7A-3 | File Download & Upload Streaming | ✅ Complete |

### Slice 5 — Minor Fixes Outstanding
A fix file was produced (slice-5-fixes-for-cline.md) covering:
1. Nav label should be "So Whats" not "Sowhats"
2. Audience/Orientation chip selected state styling on edit form
3. Save button colour on edit form
4. Guidance panel: hide on read-only detail view (keep on create/edit)

Check with Cline whether these have been applied.

---

## Slice 7A — Google Drive Integration (Complete)

### Architecture: Shared Drive Model

Each client gets their own Google Shared Drive. This solves the service account storage quota limitation (SAs have no personal storage quota; Shared Drives use org-level quota).

**How it works:**
- **Provisioning**: SA impersonates a Workspace user (`keith.new@aboutime.co.uk`) via domain-wide delegation to create the Shared Drive. SA is then added as Content Manager (organizer). All subsequent operations use the SA directly — no impersonation needed.
- **Browse/Upload/Download**: SA operates as a direct member of the Shared Drive. All API calls include `supportsAllDrives: true` and `includeItemsFromAllDrives: true`.
- **Backwards compatibility**: Legacy clients (Cegid Spain) still use regular Drive folders via `driveFolderId`. All routes check `driveId || driveFolderId` and adapt behaviour accordingly.

**Provisioning state machine** (resilient to partial failures):
- State A: Create Shared Drive (via impersonated client)
- State B: Add SA as Content Manager
- State C: Persist `driveId` + `driveProvisionStatus: "created"` + `folderProvisionStatus: "pending"` to Firestore BEFORE folder creation
- State D: Create canonical folder tree with retry logic (max 5 attempts, 2s delay between retries, only retries on propagation errors)
- State E: On re-call, if `driveId` exists with `folderProvisionStatus: "pending"`, resumes folder creation. If `"complete"`, returns 409.

### Drive API Files Created

```
src/lib/drive/
  ├── client.ts          — getDriveClient() (ADC), getDriveClientAsSA() (JWT via Secret Manager),
  │                        getDriveClientWithImpersonation() (JWT + subject for DWD)
  ├── types.ts           — DriveItem interface, DRIVE_FOLDER_MIME_TYPE
  ├── folder-template.ts — CANONICAL_FOLDER_TEMPLATE constant (single source of truth)
  ├── browse.ts          — listFolderContents(), isFolderWithinRoot(), isFileWithinRoot()
  ├── provision.ts       — createSharedDrive(), createFolderTree()
  ├── download.ts        — downloadDriveFile() with Google Workspace export (Docs→PDF, Sheets→xlsx)
  └── upload.ts          — uploadToDrive() with 50MB limit

src/app/api/clients/[clientId]/documents/
  ├── browse/route.ts    — GET, lists folder contents, subfolder navigation via ?folderId=
  ├── provision/route.ts — POST, state machine provisioning, internal-admin only
  ├── download/[fileId]/route.ts — GET, streams file through Exchange
  └── upload/route.ts    — POST, multipart form data, creates file in Drive
```

### Canonical Folder Structure (per client)

| Folder | Visibility | Purpose |
|--------|-----------|---------|
| Targeting | Client-visible | ICP research, target list source docs |
| TLM Ready Material | Client-visible | Case studies, white papers for agents |
| Client Material | Client-visible | Documents the client provides |
| Scripts | (parent) | Container for two subfolders |
| Scripts / Client Approved | Client-visible | Client-signed-off scripts |
| Scripts / Internal Working | Internal-only | AM's operational scripts |
| AI Source Documents | Client-visible | PDFs feeding AI vector pipeline |

### Drive Client Identity Model (Critical — Hard-won Knowledge)

On Cloud Run, there are TWO service account identities:
1. **`33083036927-compute@developer.gserviceaccount.com`** — Cloud Run's default compute SA. Used by `GoogleAuth` (ADC). This is what `getDriveClient()` resolves to.
2. **`firebase-adminsdk-fbsvc@angsana-exchange.iam.gserviceaccount.com`** — The Firebase Admin SA whose key is in Secret Manager. This is the SA added as Content Manager on Shared Drives.

**For Shared Drive operations**, the code must use `getDriveClientAsSA()` which loads the Firebase Admin SA key from Secret Manager and creates a JWT-authenticated client. Using `getDriveClient()` (ADC/metadata server) for Shared Drive operations will fail because the compute SA is not a member of any Shared Drives.

**For legacy folder operations** (Cegid Spain), `getDriveClient()` (ADC) works because the Firebase Admin SA was shared as Editor on those folders — but on Cloud Run, ADC resolves to the compute SA which also has access via the project. This is a separate path and works differently.

### Domain-Wide Delegation Setup

- **SA Client ID**: `104001036429095716955`
- **Authorised in Google Workspace admin**: Security → API Controls → Domain-wide Delegation
- **OAuth scope**: `https://www.googleapis.com/auth/drive`
- **Impersonation target**: `keith.new@aboutime.co.uk` (env var `DRIVE_IMPERSONATION_EMAIL`)
- **Used only for**: `drives.create` (creating new Shared Drives)
- **Primary domain**: `angsana-uk.com` — `aboutime.co.uk` is a secondary domain in the same Workspace

### Key Bugs Found and Fixed

1. **Middleware redirect on API routes** — Next.js middleware was redirecting `/api/clients/*` to `/login` for Bearer token callers. Fixed: middleware now checks Bearer header as fallback when no `__session` cookie present. Returns 401 JSON on API paths instead of redirecting.

2. **Parent-chain validation fails for inherited access** — `files.get` returns `parents: undefined` for files/folders the SA accesses via inherited sharing (not direct ownership). Fixed: replaced upward parent-chain walk with top-down BFS from root, listing all items at each level.

3. **SA storage quota** — Service accounts have no personal storage quota and cannot create files in Drive. Fixed: switched to Shared Drives (org-level quota).

4. **SA identity mismatch on Cloud Run** — `getDriveClient()` using ADC resolves to the Cloud Run compute SA, not the Firebase Admin SA that was added to Shared Drives. Fixed: added `getDriveClientAsSA()` that loads the Firebase Admin SA key from Secret Manager for JWT auth.

5. **Permission propagation delay** — After adding SA as Shared Drive member, immediate folder creation fails with "File not found". Fixed: retry loop (max 5 attempts, 2s delay) on propagation-related errors only.

6. **Idempotency key reuse** — Google remembers `requestId` even after a Shared Drive is deleted. Using deterministic keys prevents retry but also prevents re-provisioning after cleanup. Fixed: use `exchange-${clientId}-${Date.now()}` for requestId; rely on Firestore 409 guard for true idempotency.

---

## Firestore Structure (Current State)

```
tenants/{tenantId}
  ├── config
  ├── managedLists/
  │   ├── serviceTypes         (7 items)
  │   ├── sectors              (10 items)
  │   ├── geographies          (12 items)
  │   ├── titleBands           (11 items with orientation tags)
  │   ├── companySizes         (4 items)
  │   ├── therapyAreas         (9 items)
  │   ├── objectionCategories  (AI signal taxonomy — future)
  │   └── signalTypes          (AI signal taxonomy — future)
  ├── users/                   (queryable user records)
  │   └── {uid}
  ├── apiKeys/                 (hashed API key metadata)
  │   └── {keyId}
  ├── apiLogs/                 (mutation audit trail, 90-day TTL)
  │   └── {logId}
  └── clients/
      └── {clientId}
          ├── config               (name, tier, capabilities, competitors,
          │                         therapyAreas, conflictedTherapyAreas,
          │                         sfAccountId, status, lapsedAt, lapsedBy,
          │                         --- Drive fields (new clients): ---
          │                         driveId, driveProvisionStatus,
          │                         folderProvisionStatus,
          │                         driveProvisionedAt, driveProvisionedBy,
          │                         lastProvisionAttemptAt, lastProvisionError,
          │                         --- Drive fields (legacy clients): ---
          │                         driveFolderId)
          ├── checkIns/            (2 seeded for Cegid)
          ├── actions/             (5 seeded for Cegid)
          ├── wishlists/           (5 seeded for Cegid)
          ├── soWhats/             (5 seeded for Cegid)
          ├── dnc/                 (placeholder — future)
          ├── msaPsl/              (placeholder — future)
          ├── documents/           (placeholder — future, Firestore registry for Drive files)
          ├── insights/            (AI signals — future)
          │   ├── competitorMentions/
          │   ├── objections/
          │   ├── timingSignals/
          │   ├── interestIndicators/
          │   └── marketSignals/
          └── campaigns/
              └── {campaignId}
                  ├── approvals/       (placeholder — future)
                  ├── researchBrief    (placeholder — future)
                  └── directives/      (placeholder — future)
```

## What Comes Next: Document Management Steps 4–6

### Step 4 — Firestore Document Registry
Lightweight metadata per file in `clients/{clientId}/documents/` sub-collection:
- driveFileId, name, mimeType, folder category, visibility (client-visible / internal-only), uploadedBy, uploadedAt, campaignRef (optional)
- Enables role-based visibility filtering (client users only see client-visible files)
- Upload route creates both the Drive file and the Firestore registry entry
- Browse can optionally read from Firestore (fast, pre-filtered) rather than Drive API (slower, unfiltered)

### Step 5 — Documents UI for Internal Users
- Document browser page at `/clients/{clientId}/documents`
- Folder tree navigation, file list, upload button, download links
- Internal users see all files regardless of visibility

### Step 6 — Client Document View
- Client-facing document page showing only client-visible documents
- Campaign detail page gets a "Documents" section showing linked files
- Client-approver can upload to specific folders (Client Material, Targeting, TLM Ready Material, AI Source Documents)

### Approval Pattern (Agreed Design, Not Yet Built)
- An approval is a timestamp, not a snapshot
- Firestore approval record: itemType, driveFileId, status (submitted → chased → approved / rejected / approved-by-default), submittedBy, submittedAt, approvedBy, approvedAt
- If Drive file's modifiedTime > approvedAt, Exchange can flag "modified since approval" (optional, deferred decision)
- Works for scripts, email cadences, briefing docs — anything in Drive that needs client sign-off

---

## Still Outstanding (Other Future Slices)

### Data Entity Modules
- **DNC** — client-wide exclusion list inherited by campaigns. Separate nav item.
- **MSA-PSL** — structured entries with where-working and where-could-go. Separate nav item.
- **Campaign Directives** — instruction log on campaigns. Placeholder exists on campaign detail page.
- **Research Brief** — structured ICP fields on campaigns replacing Target List Template sheet.

### Integrations
- **Looker Dashboard Embedding** — parameterised by clientId, existing Cloud Function for embed URL signing. Depends on BQ marts and Looker readiness.
- **Target List Approval** — likely Looker-embedded views backed by SF/BQ marts (not CSVs in Drive). Approval workflow in Firestore.
- **assignedClients sync** — scheduled Cloud Function reading BQ sf_raw.AccountTeamMember → Firestore.

### Platform Features
- **Scripts** — dual script model: client-approved (Drive doc + approval) + internal working version.
- **Email Cadences** — array per campaign, individual approval per cadence round.
- **Intelligence Views** — consume AI signals from Core pipeline via Looker.
- **AI Campaign Review** — reviews campaign quality using So Whats, targeting, client docs.
- **AI Chat** — conversational interface to Exchange data.

### Infrastructure
- **Platform router routes.json** — add Exchange API route entry.
- **Cloud Monitoring alerts** — request volume, auth failures, instance count.
- **Firebase Auth hardening** — verify brute-force protections.
- **Existing client migration to Shared Drives** — one-by-one workstream. Create Shared Drive, copy files, update config, verify, remove old folder sharing.

---

## Test Users

| Email | Role | Password |
|-------|------|----------|
| keith@angsana.com | internal-admin | Exchange2026! |
| mike@angsana.com | internal-user | Exchange2026! |
| alessandro@cegid.com | client-approver | Exchange2026! |
| monica@cegid.com | client-viewer | Exchange2026! |

## Test Clients

| Client ID | Drive Type | Drive/Folder ID | Notes |
|-----------|-----------|----------------|-------|
| cegid-spain | Legacy folder | `1ZlJtt0G2-N2L9n_s36dpY-fyJHbu4Yik` | Uses `driveFolderId`. Real client data. |
| test-provision | Shared Drive | `0ACjq_eGyh3R_Uk9PVA` | Uses `driveId`. Test data only. |
| wavix | None | — | Stub client, no Drive setup. |

## Key Technical Context

- **GCP Project**: angsana-exchange
- **Repo**: keithnew/angsana-exchange on GitHub
- **Stack**: Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, Firebase Auth, Firestore, Cloud Run
- **Region**: europe-west2 (London)
- **Firestore**: Standard, europe-west2, database ID default
- **Domain routing**: Firebase Hosting (reverse proxy) → Cloud Run
- **Font**: Quicksand (Google Fonts, weights 300/400/700)
- **Brand palette**: #004156 primary dark teal, #3B7584 secondary mid teal, #827786 ashberry mauve, #FCB242 accent gold, #00A6CE accent cyan, #30BAA0 accent green, #EC1E65 accent magenta, #3B4A55 dark slate background
- **API URL pattern**: /api/v1/exchange/{env}/api/{collection} — matches platform convention
- **API auth**: Firebase ID tokens (UI), API keys (automation), client JWT (future placeholder)
- **Middleware**: Supports both `__session` cookie (browser UI) and `Authorization: Bearer` header (curl/API) on all `/api/clients/*` routes
- **Drive API**: googleapis npm package. Three client types: getDriveClient() (ADC), getDriveClientAsSA() (JWT via Secret Manager), getDriveClientWithImpersonation() (JWT + DWD subject)
- **Secret Manager**: `firebase-admin-sa-key` — Firebase Admin SA key JSON. Accessed by Cloud Run compute SA (`33083036927-compute@developer.gserviceaccount.com`) via `roles/secretmanager.secretAccessor`
- **Domain-wide delegation**: SA Client ID `104001036429095716955`, scope `https://www.googleapis.com/auth/drive`, impersonation target `keith.new@aboutime.co.uk` via `DRIVE_IMPERSONATION_EMAIL` env var

## Documents Produced

| Document | Slice | Description |
|----------|-------|-------------|
| angsana-exchange-slice-2.docx | 2 | Campaign detail, create, edit, managed lists |
| angsana-exchange-slice-2-plus.docx | 2+ | Client settings, capabilities pattern |
| angsana-exchange-slice-3.docx | 3 | Check-ins, actions, auto-action generation |
| angsana-exchange-slice-4.docx | 4 | Wishlists, portfolio dashboard |
| angsana-exchange-slice-5.docx | 5 | So Whats library |
| angsana-exchange-slice-6a-rev2.docx | 6A | Exchange API layer & auth infrastructure (revised) |
| angsana-exchange-slice-6b.docx | 6B | User & client lifecycle, Team page, admin Users page |
| angsana-exchange-slice-7a-step1.docx | 7A-1 | Drive API connectivity & browse endpoint |
| angsana-exchange-slice-7a-step2.docx | 7A-2 | Folder provisioning (original, superseded) |
| angsana-exchange-slice-7a-step3.docx | 7A-3 | File download & upload streaming |
| angsana-exchange-slice-7a-step2-3-revised.docx | 7A-2/3 | Shared Drive model revision |

## Deployment Commands

```bash
# Build & push
gcloud builds submit \
  --project=angsana-exchange \
  --region=europe-west2 \
  --tag=europe-west2-docker.pkg.dev/angsana-exchange/exchange-images/exchange:latest

# Deploy to Cloud Run
gcloud run deploy angsana-exchange \
  --project=angsana-exchange \
  --region=europe-west2 \
  --image=europe-west2-docker.pkg.dev/angsana-exchange/exchange-images/exchange:latest \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --timeout=60 \
  --concurrency=80 \
  --cpu-boost \
  --set-env-vars="FIREBASE_PROJECT_ID=angsana-exchange,GCP_PROJECT_ID=angsana-exchange,GCP_REGION=europe-west2,NODE_ENV=production"

# Note: DRIVE_IMPERSONATION_EMAIL is set in .env.production (baked into Docker image)
# No need to include in --set-env-vars

# Redeploy Firebase Hosting (if firebase.json changes)
firebase deploy --only hosting --project angsana-exchange
```

## How to Test Drive Endpoints via curl

```bash
# Get a Firebase ID token
TOKEN=$(curl -s -X POST \
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAZ2V2si0JRo0T7lFZDdS-Gudk0WtgttJo' \
  -H 'Content-Type: application/json' \
  -d '{"email":"keith@angsana.com","password":"Exchange2026!","returnSecureToken":true}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['idToken'])")

# Browse a client's Drive
curl -s "https://exchange.angsana-uk.com/api/clients/test-provision/documents/browse" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Upload a file
curl -s -X POST "https://exchange.angsana-uk.com/api/clients/test-provision/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/file.pdf" \
  -F "folderId=FOLDER_ID_HERE" | python3 -m json.tool

# Download a file
curl -s -o output.pdf \
  "https://exchange.angsana-uk.com/api/clients/test-provision/documents/download/FILE_ID_HERE" \
  -H "Authorization: Bearer $TOKEN"

# Provision a new client's Shared Drive (internal-admin only)
curl -s -X POST "https://exchange.angsana-uk.com/api/clients/CLIENT_ID/documents/provision" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Token expires after 1 hour — re-run the TOKEN= command to refresh
```
