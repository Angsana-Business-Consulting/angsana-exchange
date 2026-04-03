// =============================================================================
// Angsana Exchange — Shared Type Definitions
// =============================================================================

/**
 * Custom claims embedded in Firebase Auth JWT tokens.
 * Issued by a Cloud Function at login time.
 */
export interface AuthClaims {
  /** Client identifier — scopes all data access */
  clientId: string;
  /** User role */
  role: 'client' | 'internal';
  /** Which Exchange modules this user can access */
  permittedModules: string[];
}

/**
 * Navigation menu item consumed by the Sidebar component.
 */
export interface NavItem {
  /** Display label */
  label: string;
  /** Route path */
  route: string;
  /** Lucide icon name */
  icon: string;
  /** Roles that can see this item (empty = visible to all) */
  roles?: Array<'client' | 'internal'>;
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
