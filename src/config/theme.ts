import type { ThemeConfig } from '@/types';

/**
 * Default theme — Angsana branding.
 *
 * This is the baseline theme for tenant zero (Angsana itself).
 * When white-labelling is needed, this config object gets swapped —
 * no code changes required, just a different config.
 */
export const defaultTheme: ThemeConfig = {
  name: 'Angsana',

  // Logo paths — relative to /public
  // TODO: Replace with actual logo files once added to public/brand/
  logoPath: '/brand/logo-horizontal.png',
  markPath: '/brand/mark.png',
  logoReversedPath: '/brand/logo-reversed.png',

  colours: {
    primary: '#004156',
    secondary: '#3B7584',
    muted: '#827786',
    accentGold: '#FCB242',
    accentCyan: '#00A6CE',
    accentGreen: '#30BAA0',
    accentMagenta: '#EC1E65',
    backgroundDark: '#3B4A55',
    background: '#FFFFFF',
    foreground: '#1A1A1A',
  },
};
