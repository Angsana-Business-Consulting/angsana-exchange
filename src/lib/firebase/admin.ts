import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin SDK — runs server-side only (API routes, middleware, server components).
 *
 * On Cloud Run, credentials are auto-detected from the service account.
 * For local dev, set GOOGLE_APPLICATION_CREDENTIALS to a service account key file.
 */
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // On Cloud Run: auto-detected. Locally: uses GOOGLE_APPLICATION_CREDENTIALS.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      projectId: process.env.FIREBASE_PROJECT_ID || 'angsana-exchange',
    });
  }

  // Fallback for Cloud Run / GCE environments
  return initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'angsana-exchange',
  });
}

const adminApp = getAdminApp();
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);

export { adminApp, adminAuth, adminDb };
