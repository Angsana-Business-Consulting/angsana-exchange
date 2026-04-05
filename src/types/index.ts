// =============================================================================
// Angsana Exchange — Shared Type Definitions
// =============================================================================

/**
 * User roles — determines navigation, permissions, and available actions.
 */
export type UserRole =
  | 'internal-admin'
  | 'internal-user'
  | 'client-approver'
  | 'client-viewer';

/**
 * Custom claims embedded in Firebase Auth JWT tokens.
 * Issued by seed script (Slice 1) or Cloud Function (later slices).
 */
export interface AuthClaims {
  /** Tenant identifier — scopes all Firestore reads to tenants/{tenantId}/... */
  tenantId: string;
  /** User role — determines navigation, permissions, and available actions */
  role: UserRole;
  /** For client users: their single client ID. For internal users: null. */
  clientId: string | null;
  /** For internal users: array of client IDs they can access. ["*"] for admin. */
  assignedClients: string[] | null;
  /** Which modules appear in navigation */
  permittedModules: string[];
}

/**
 * Serialisable user context — passed from server to client components.
 * This is the shape stored in AuthContext and read by the UI.
 */
export interface UserContext {
  /** Firebase Auth UID */
  uid: string;
  /** User's email address */
  email: string;
  /** Display name (from Firebase Auth profile) */
  displayName: string;
  /** All custom claims */
  claims: AuthClaims;
}

/**
 * Navigation menu item consumed by the Sidebar component.
 */
export interface NavItem {
  /** Display label */
  label: string;
  /** Route path — can include {clientId} placeholder */
  route: string;
  /** Lucide icon name */
  icon: string;
  /** Which roles can see this item (empty array = visible to all authenticated users) */
  roles?: UserRole[];
  /** Module key — matched against permittedModules claim */
  module?: string;
}

/**
 * Theme configuration for brand identity.
 * Applied via CSS variables by the ThemeProvider.
 */
export interface ThemeConfig {
  /** Display name */
  name: string;
  /** Path to primary logo (horizontal lock-up) */
  logoPath: string;
  /** Path to compact mark (icon only) */
  markPath: string;
  /** Path to reversed/white logo for dark backgrounds */
  logoReversedPath: string;
  /** Colour palette — values are CSS colour strings (hex, hsl, etc.) */
  colours: {
    primary: string;
    secondary: string;
    muted: string;
    accentGold: string;
    accentCyan: string;
    accentGreen: string;
    accentMagenta: string;
    backgroundDark: string;
    background: string;
    foreground: string;
  };
}

/**
 * Client config document from Firestore (tenants/{tenantId}/clients/{clientId}).
 */
export interface ClientConfig {
  /** Document ID (slug) */
  id: string;
  /** Display name */
  name: string;
  /** URL-safe slug */
  slug: string;
  /** Service tier */
  tier: 'premium' | 'standard' | 'trial';
  /** Competitors list */
  competitors: string[];
  /** Path to client logo (optional) */
  logoPath: string | null;
}

/**
 * Campaign document from Firestore.
 */
export interface Campaign {
  /** Document ID */
  id: string;
  /** Campaign display name */
  campaignName: string;
  /** Current status */
  status: 'draft' | 'active' | 'paused' | 'completed';
  /** Service type label */
  serviceType: string;
  /** Service type ID (references managed list) */
  serviceTypeId: string;
  /** Campaign owner name */
  owner: string;
  /** Campaign start date (ISO string for client-side use) */
  startDate: string;
  /** One-line campaign summary */
  campaignSummary: string;
  /** Target geographies */
  targetGeographies: string[];
  /** Target sectors */
  targetSectors: string[];
  /** Target job titles */
  targetTitles: string[];
  /** Created timestamp (ISO string) */
  createdAt: string;
  /** Last updated timestamp (ISO string) */
  updatedAt: string;
}

/**
 * Campaign status with display metadata.
 */
export const CAMPAIGN_STATUS_CONFIG: Record<
  Campaign['status'],
  { label: string; colour: string; bgColour: string }
> = {
  draft: { label: 'Draft', colour: '#6B7280', bgColour: '#F3F4F6' },
  active: { label: 'Active', colour: '#059669', bgColour: '#ECFDF5' },
  paused: { label: 'Paused', colour: '#D97706', bgColour: '#FFFBEB' },
  completed: { label: 'Completed', colour: '#4B5563', bgColour: '#F9FAFB' },
};
