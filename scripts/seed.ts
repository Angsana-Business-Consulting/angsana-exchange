#!/usr/bin/env npx tsx
/**
 * Angsana Exchange — Slice 1 Seed Script
 *
 * Creates everything needed for a working Slice 1 environment:
 *   1. Firebase Auth users (4 test users with displayNames)
 *   2. Custom claims on each user (tenantId, role, clientId, assignedClients, permittedModules)
 *   3. Firestore structure: tenant config, managed lists, clients, campaigns
 *
 * Idempotent: safe to re-run. Existing users are updated, Firestore docs are overwritten.
 *
 * Prerequisites:
 *   - gcloud auth application-default login  (or GOOGLE_APPLICATION_CREDENTIALS set)
 *   - Target project: angsana-exchange
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// =============================================================================
// Configuration
// =============================================================================

const PROJECT_ID = 'angsana-exchange';
const TENANT_ID = 'angsana';
const DEFAULT_PASSWORD = 'Exchange2026!';

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
    // Application Default Credentials (gcloud auth application-default login)
    console.log('  Using Application Default Credentials');
    initializeApp({ projectId: PROJECT_ID });
  }
}

// =============================================================================
// Test Users
// =============================================================================

interface TestUser {
  email: string;
  displayName: string;
  password: string;
  claims: {
    tenantId: string;
    role: 'internal-admin' | 'internal-user' | 'client-approver' | 'client-viewer';
    clientId: string | null;
    assignedClients: string[] | null;
    permittedModules: string[];
  };
}

const TEST_USERS: TestUser[] = [
  {
    email: 'keith@angsana.com',
    displayName: 'Keith New',
    password: DEFAULT_PASSWORD,
    claims: {
      tenantId: TENANT_ID,
      role: 'internal-admin',
      clientId: null,
      assignedClients: ['*'],
      permittedModules: [
        'campaigns', 'checkins', 'actions', 'sowhats', 'wishlists',
        'dnc', 'msa-psl', 'documents', 'dashboard', 'admin',
      ],
    },
  },
  {
    email: 'mike@angsana.com',
    displayName: 'Mike Cole',
    password: DEFAULT_PASSWORD,
    claims: {
      tenantId: TENANT_ID,
      role: 'internal-user',
      clientId: null,
      assignedClients: ['cegid-spain', 'wavix'],
      permittedModules: [
        'campaigns', 'checkins', 'actions', 'sowhats', 'wishlists',
        'dnc', 'msa-psl', 'documents', 'dashboard',
      ],
    },
  },
  {
    email: 'alessandro@cegid.com',
    displayName: 'Alessandro Rossi',
    password: DEFAULT_PASSWORD,
    claims: {
      tenantId: TENANT_ID,
      role: 'client-approver',
      clientId: 'cegid-spain',
      assignedClients: null,
      permittedModules: [
        'campaigns', 'checkins', 'actions', 'documents', 'dashboard', 'approvals',
      ],
    },
  },
  {
    email: 'monica@cegid.com',
    displayName: 'Monica Garcia',
    password: DEFAULT_PASSWORD,
    claims: {
      tenantId: TENANT_ID,
      role: 'client-viewer',
      clientId: 'cegid-spain',
      assignedClients: null,
      permittedModules: [
        'campaigns', 'checkins', 'actions', 'documents', 'dashboard',
      ],
    },
  },
];

// =============================================================================
// Seed Auth Users + Custom Claims
// =============================================================================

async function seedUsers() {
  const auth = getAuth();

  for (const user of TEST_USERS) {
    let uid: string;

    try {
      // Check if user already exists
      const existing = await auth.getUserByEmail(user.email);
      uid = existing.uid;
      console.log(`  ✓ User exists: ${user.email} (${uid})`);

      // Update display name and password
      await auth.updateUser(uid, {
        displayName: user.displayName,
        password: user.password,
      });
      console.log(`    Updated displayName and password`);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr.code === 'auth/user-not-found') {
        // Create new user
        const created = await auth.createUser({
          email: user.email,
          displayName: user.displayName,
          password: user.password,
          emailVerified: true,
        });
        uid = created.uid;
        console.log(`  ✓ Created user: ${user.email} (${uid})`);
      } else {
        throw err;
      }
    }

    // Set custom claims
    await auth.setCustomUserClaims(uid, user.claims);
    console.log(`    Set claims: role=${user.claims.role}, clientId=${user.claims.clientId}`);
  }
}

// =============================================================================
// Firestore Seed Data
// =============================================================================

async function seedFirestore() {
  const db = getFirestore();
  const now = Timestamp.now();

  const tenantRef = db.collection('tenants').doc(TENANT_ID);

  // --- Tenant config ---
  console.log('  Seeding tenant config...');
  await tenantRef.set({
    name: 'Angsana',
    displayName: 'Angsana Business Consulting',
    region: 'europe-west2',
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  // --- Managed Lists ---
  console.log('  Seeding managed lists...');
  const managedListsRef = tenantRef.collection('managedLists');

  await managedListsRef.doc('serviceTypes').set({
    items: [
      { id: 'lg-new', label: 'Lead Gen — New Business', active: true },
      { id: 'lg-cross', label: 'Lead Gen — Cross-Sell', active: true },
      { id: 'abm', label: 'Account-Based Marketing', active: true },
      { id: 'event', label: 'Event Follow-Up', active: true },
      { id: 'reactivation', label: 'Warm Reactivation', active: true },
      { id: 'pipeline', label: 'Pipeline Acceleration', active: true },
      { id: 'research', label: 'Market Research', active: true },
    ],
    updatedAt: now,
  });

  await managedListsRef.doc('sectors').set({
    items: [
      { id: 'fashion-retail', label: 'Fashion Retail', active: true },
      { id: 'luxury', label: 'Luxury', active: true },
      { id: 'outdoor-sportswear', label: 'Outdoor & Sportswear', active: true },
      { id: 'food-beverage', label: 'Food & Beverage', active: true },
      { id: 'health-beauty', label: 'Health & Beauty', active: true },
      { id: 'home-garden', label: 'Home & Garden', active: true },
      { id: 'technology', label: 'Technology', active: true },
      { id: 'financial-services', label: 'Financial Services', active: true },
      { id: 'professional-services', label: 'Professional Services', active: true },
      { id: 'manufacturing', label: 'Manufacturing', active: true },
    ],
    updatedAt: now,
  });

  await managedListsRef.doc('geographies').set({
    items: [
      { id: 'spain', label: 'Spain', active: true },
      { id: 'portugal', label: 'Portugal', active: true },
      { id: 'uk', label: 'United Kingdom', active: true },
      { id: 'france', label: 'France', active: true },
      { id: 'germany', label: 'Germany', active: true },
      { id: 'italy', label: 'Italy', active: true },
      { id: 'nordics', label: 'Nordics', active: true },
      { id: 'benelux', label: 'Benelux', active: true },
      { id: 'usa', label: 'United States', active: true },
    ],
    updatedAt: now,
  });

  await managedListsRef.doc('titleBands').set({
    items: [
      { id: 'c-suite', label: 'C-Suite', active: true },
      { id: 'vp', label: 'VP / SVP', active: true },
      { id: 'director', label: 'Director', active: true },
      { id: 'head-of', label: 'Head of', active: true },
      { id: 'manager', label: 'Manager', active: true },
    ],
    updatedAt: now,
  });

  await managedListsRef.doc('companySizes').set({
    items: [
      { id: 'enterprise', label: 'Enterprise (5000+)', active: true },
      { id: 'mid-market', label: 'Mid-Market (500–5000)', active: true },
      { id: 'smb', label: 'SMB (50–500)', active: true },
      { id: 'startup', label: 'Startup (<50)', active: true },
    ],
    updatedAt: now,
  });

  // --- Client: Cegid Spain (full, with campaigns) ---
  console.log('  Seeding client: cegid-spain...');
  const cegidRef = tenantRef.collection('clients').doc('cegid-spain');

  await cegidRef.set({
    name: 'Cegid Group Spain',
    slug: 'cegid-spain',
    tier: 'premium',
    therapyAreas: [],
    conflictedTherapyAreas: [],
    competitors: ['Oracle Retail', 'SAP', 'Shopify POS'],
    logoPath: null,
    createdAt: now,
    updatedAt: now,
  });

  // Campaigns for Cegid Spain
  console.log('  Seeding campaigns for cegid-spain...');
  const campaignsRef = cegidRef.collection('campaigns');

  const campaigns = [
    {
      id: 'iberia-retail-pos-fashion',
      data: {
        campaignName: 'Iberia Retail POS — Fashion & Luxury',
        status: 'active',
        serviceType: 'Lead Gen — New Business',
        serviceTypeId: 'lg-new',
        owner: 'Mike Cole',
        startDate: Timestamp.fromDate(new Date('2025-12-18')),
        campaignSummary:
          'Targeting CTO/CIO/Digital leaders at fashion and luxury retailers in Spain and Portugal for Cegid unified commerce platform.',
        targetGeographies: ['Spain', 'Portugal'],
        targetSectors: ['Fashion Retail', 'Luxury'],
        targetTitles: ['CTO', 'CIO', 'Digital', 'Operations'],
        createdAt: Timestamp.fromDate(new Date('2025-12-10')),
        updatedAt: now,
      },
    },
    {
      id: 'iberia-retail-pos-outdoor',
      data: {
        campaignName: 'Iberia Retail POS — Outdoor & Sportswear',
        status: 'active',
        serviceType: 'Lead Gen — New Business',
        serviceTypeId: 'lg-new',
        owner: 'Mike Cole',
        startDate: Timestamp.fromDate(new Date('2026-01-15')),
        campaignSummary:
          'Same proposition targeting outdoor, sportswear, and activewear retailers across Iberia.',
        targetGeographies: ['Spain', 'Portugal'],
        targetSectors: ['Outdoor & Sportswear'],
        targetTitles: ['CTO', 'CIO', 'Digital', 'Operations'],
        createdAt: Timestamp.fromDate(new Date('2026-01-08')),
        updatedAt: now,
      },
    },
    {
      id: 'retail-forum-event-followup',
      data: {
        campaignName: 'Retail Forum Event Follow-Up',
        status: 'draft',
        serviceType: 'Event Follow-Up',
        serviceTypeId: 'event',
        owner: 'Deborah Rey',
        startDate: Timestamp.fromDate(new Date('2026-02-20')),
        campaignSummary:
          'Follow-up outreach to attendees of the 2026 Retail Forum event. Speaker-led content positioning.',
        targetGeographies: ['Spain'],
        targetSectors: ['Fashion Retail', 'Luxury', 'Outdoor & Sportswear'],
        targetTitles: ['CTO', 'CIO', 'CEO'],
        createdAt: Timestamp.fromDate(new Date('2026-02-01')),
        updatedAt: now,
      },
    },
  ];

  for (const campaign of campaigns) {
    await campaignsRef.doc(campaign.id).set(campaign.data);
    console.log(`    ✓ Campaign: ${campaign.data.campaignName}`);
  }

  // --- Client: Wavix (stub — no campaigns) ---
  console.log('  Seeding client: wavix (stub)...');
  const wavixRef = tenantRef.collection('clients').doc('wavix');

  await wavixRef.set({
    name: 'Wavix Technologies',
    slug: 'wavix',
    tier: 'standard',
    therapyAreas: [],
    conflictedTherapyAreas: [],
    competitors: ['Twilio', 'Vonage', 'Bandwidth'],
    logoPath: null,
    createdAt: now,
    updatedAt: now,
  });
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Angsana Exchange — Slice 1 Seed Script      ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  console.log('→ Initialising Firebase Admin...');
  initAdmin();
  console.log('');

  console.log('→ Seeding Auth users + custom claims...');
  await seedUsers();
  console.log('');

  console.log('→ Seeding Firestore data...');
  await seedFirestore();
  console.log('');

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Test accounts (password: Exchange2026!):');
  for (const user of TEST_USERS) {
    console.log(`  ${user.email.padEnd(28)} ${user.claims.role}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('');
  console.error('❌ Seed failed:', err.message || err);
  console.error('');
  if (err.message?.includes('Could not load the default credentials')) {
    console.error('Hint: Run "gcloud auth application-default login" first.');
  }
  process.exit(1);
});
