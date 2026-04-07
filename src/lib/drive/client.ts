// =============================================================================
// Angsana Exchange — Drive API Client
// Slice 7A: Google Drive API Connectivity & Browse Endpoint
//
// Provides two Drive v3 clients:
//   getDriveClient()                  — SA acting as itself (Content Manager)
//   getDriveClientWithImpersonation() — SA impersonating a Workspace user
//
// Credentials are loaded once from GOOGLE_APPLICATION_CREDENTIALS (locally)
// or the Cloud Run metadata server and shared between both clients.
//
// Impersonation is ONLY needed for drives.create (creating Shared Drives).
// All other operations (browse, upload, download, folder creation inside a
// Shared Drive) use the regular client — the SA is a direct member.
// =============================================================================

import { google, type drive_v3 } from 'googleapis';
import * as fs from 'fs';

// ─── Shared credential loading ───────────────────────────────────────────────

interface SACredentials {
  client_email: string;
  private_key: string;
}

let cachedCredentials: SACredentials | null = null;

/**
 * Load SA credentials from the JSON key file specified by
 * GOOGLE_APPLICATION_CREDENTIALS. Returns null if the env var isn't set
 * (Cloud Run metadata-server path where no key file exists, though the
 * impersonation client requires explicit credentials).
 *
 * Credentials are loaded once and cached for the process lifetime.
 */
function loadSACredentials(): SACredentials | null {
  if (cachedCredentials) return cachedCredentials;

  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFilePath) return null;

  try {
    const raw = fs.readFileSync(keyFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    cachedCredentials = {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
    return cachedCredentials;
  } catch (err) {
    console.error('[drive/client] Failed to load SA credentials from', keyFilePath, err);
    return null;
  }
}

// ─── Regular Drive client (SA as itself) ─────────────────────────────────────

let driveClient: drive_v3.Drive | null = null;

/**
 * Returns an authenticated Google Drive v3 API client.
 *
 * Uses GoogleAuth which automatically resolves credentials:
 * - Locally: reads the JSON key file specified by GOOGLE_APPLICATION_CREDENTIALS
 * - Cloud Run: uses the attached service account via metadata server
 *
 * The client is created once and reused on subsequent calls (same lazy-init
 * pattern as the Firebase Admin SDK in lib/firebase/admin.ts).
 */
export function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

// ─── Impersonated Drive client (SA impersonating a Workspace user) ───────────

let impersonatedDriveClient: drive_v3.Drive | null = null;

/**
 * Returns a Drive v3 client that impersonates a Workspace user via
 * domain-wide delegation.
 *
 * This is ONLY used for creating Shared Drives (drives.create) — an
 * operation that requires a Workspace user context. All other Drive
 * operations use getDriveClient() because the SA is a Content Manager
 * on each Shared Drive.
 *
 * The impersonation target is read from DRIVE_IMPERSONATION_EMAIL env var.
 * Requires GOOGLE_APPLICATION_CREDENTIALS to be set (JWT auth needs the
 * SA's private key — metadata server auth cannot impersonate).
 *
 * @throws Error if credentials or impersonation email are not configured
 */
export function getDriveClientWithImpersonation(): drive_v3.Drive {
  if (impersonatedDriveClient) return impersonatedDriveClient;

  const credentials = loadSACredentials();
  if (!credentials) {
    throw new Error(
      'Cannot create impersonated Drive client: GOOGLE_APPLICATION_CREDENTIALS is not set or the key file could not be read. ' +
      'JWT-based impersonation requires an explicit SA key file.'
    );
  }

  const impersonationEmail = process.env.DRIVE_IMPERSONATION_EMAIL;
  if (!impersonationEmail) {
    throw new Error(
      'Cannot create impersonated Drive client: DRIVE_IMPERSONATION_EMAIL env var is not set. ' +
      'Set it to a Workspace user email (e.g., keith.new2@angsana-uk.com).'
    );
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: impersonationEmail,
  });

  impersonatedDriveClient = google.drive({ version: 'v3', auth });
  return impersonatedDriveClient;
}

/**
 * Returns the SA's own email address from the cached credentials.
 * Used by provision.ts to add the SA as a Content Manager on new Shared Drives.
 *
 * @throws Error if credentials are not loaded
 */
export function getSAEmail(): string {
  const credentials = loadSACredentials();
  if (!credentials) {
    throw new Error(
      'Cannot get SA email: GOOGLE_APPLICATION_CREDENTIALS is not set or the key file could not be read.'
    );
  }
  return credentials.client_email;
}
