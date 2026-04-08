// =============================================================================
// Angsana Exchange — Drive API Client
// Slice 7A: Google Drive API Connectivity & Browse Endpoint
//
// Provides three Drive v3 clients:
//   getDriveClient()                        — ADC (legacy, used for non-Shared-Drive ops)
//   getDriveClientAsSA()                    — JWT as firebase-adminsdk SA (Shared Drive member)
//   getDriveClientWithImpersonation()       — SA impersonating a Workspace user
//
// IMPORTANT: On Cloud Run, getDriveClient() (ADC) resolves to the Cloud Run
// attached SA, NOT the firebase-adminsdk SA. These are different identities.
// Since we add the firebase-adminsdk SA as Content Manager on Shared Drives,
// all Shared Drive operations MUST use getDriveClientAsSA() which authenticates
// with the same SA credentials loaded from Secret Manager / key file.
//
// getDriveClient() (ADC) is kept for backwards compatibility with legacy
// Drive folders (e.g., Cegid Spain) that were shared with the Cloud Run SA.
//
// Impersonation is ONLY needed for drives.create (creating Shared Drives).
// =============================================================================

import { google, type drive_v3 } from 'googleapis';
import * as fs from 'fs';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// ─── Shared credential loading ───────────────────────────────────────────────

interface SACredentials {
  client_email: string;
  private_key: string;
}

let cachedCredentials: SACredentials | null = null;

/**
 * Load SA credentials from GOOGLE_APPLICATION_CREDENTIALS (local dev)
 * or Secret Manager (Cloud Run).
 *
 * Strategy:
 *   1. If GOOGLE_APPLICATION_CREDENTIALS is set, read the key file from disk
 *   2. Otherwise, fetch the SA key JSON from Secret Manager using the secret
 *      name in FIREBASE_SA_SECRET_NAME (defaults to 'firebase-admin-sa-key')
 *
 * On Cloud Run, GOOGLE_APPLICATION_CREDENTIALS is NOT set — the regular
 * Firebase Admin SDK uses the metadata server (ADC). But the impersonation
 * client needs the actual private key for JWT auth, so we fetch it from
 * Secret Manager.
 *
 * Credentials are loaded once and cached for the process lifetime.
 */
async function loadSACredentials(): Promise<SACredentials> {
  if (cachedCredentials) return cachedCredentials;

  // ── Path 1: Local dev — key file on disk ────────────────────────────────
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFilePath) {
    try {
      const raw = fs.readFileSync(keyFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      cachedCredentials = {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      };
      console.log('[drive/client] Loaded SA credentials from GOOGLE_APPLICATION_CREDENTIALS');
      return cachedCredentials;
    } catch (err) {
      console.error('[drive/client] Failed to load SA credentials from', keyFilePath, err);
      throw new Error(`Failed to load SA credentials from ${keyFilePath}`);
    }
  }

  // ── Path 2: Cloud Run — fetch from Secret Manager ───────────────────────
  const secretName = process.env.FIREBASE_SA_SECRET_NAME || 'firebase-admin-sa-key';
  const projectId = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'angsana-exchange';

  try {
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
    });

    const payload = version.payload?.data;
    if (!payload) {
      throw new Error('Secret Manager returned empty payload');
    }

    const raw = typeof payload === 'string' ? payload : payload.toString('utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('Secret JSON is missing client_email or private_key');
    }

    cachedCredentials = {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };

    console.log('[drive/client] Loaded SA credentials from Secret Manager:', secretName);
    return cachedCredentials;
  } catch (err) {
    console.error('[drive/client] Failed to load SA credentials from Secret Manager:', err);
    throw new Error(
      `Cannot load SA credentials: GOOGLE_APPLICATION_CREDENTIALS is not set and ` +
      `Secret Manager fetch for "${secretName}" failed. ` +
      `JWT-based impersonation requires the SA private key.`
    );
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

// ─── JWT Drive client (firebase-adminsdk SA as itself) ───────────────────────

let saDriveClient: drive_v3.Drive | null = null;

/**
 * Returns a Drive v3 client authenticated as the firebase-adminsdk SA via JWT.
 *
 * IMPORTANT: This is the correct client for all Shared Drive operations.
 * On Cloud Run, getDriveClient() (ADC) resolves to the Cloud Run attached SA,
 * which is a DIFFERENT identity from the firebase-adminsdk SA that was added
 * as Content Manager on Shared Drives. This function guarantees the caller
 * identity matches the SA that has Shared Drive membership.
 *
 * Locally, this behaves identically to getDriveClient() because both use
 * the same GOOGLE_APPLICATION_CREDENTIALS key file.
 *
 * Credentials are loaded from GOOGLE_APPLICATION_CREDENTIALS (local dev)
 * or Secret Manager (Cloud Run). This is async because the Secret Manager
 * call is async.
 */
export async function getDriveClientAsSA(): Promise<drive_v3.Drive> {
  if (saDriveClient) return saDriveClient;

  const credentials = await loadSACredentials();

  console.log(`[drive/client] Creating JWT Drive client as SA: ${credentials.client_email}`);

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    // No subject — authenticating as the SA itself, not impersonating anyone
  });

  saDriveClient = google.drive({ version: 'v3', auth });
  return saDriveClient;
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
 *
 * Credentials are loaded from GOOGLE_APPLICATION_CREDENTIALS (local dev)
 * or Secret Manager (Cloud Run). This is async because the Secret Manager
 * call is async.
 *
 * @throws Error if credentials or impersonation email are not configured
 */
export async function getDriveClientWithImpersonation(): Promise<drive_v3.Drive> {
  if (impersonatedDriveClient) return impersonatedDriveClient;

  const credentials = await loadSACredentials();

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
 * Returns the SA's own email address.
 * Used by provision.ts to add the SA as a Content Manager on new Shared Drives.
 *
 * Credentials are loaded from GOOGLE_APPLICATION_CREDENTIALS (local dev)
 * or Secret Manager (Cloud Run). This is async because the Secret Manager
 * call is async.
 *
 * @throws Error if credentials cannot be loaded
 */
export async function getSAEmail(): Promise<string> {
  const credentials = await loadSACredentials();
  return credentials.client_email;
}
