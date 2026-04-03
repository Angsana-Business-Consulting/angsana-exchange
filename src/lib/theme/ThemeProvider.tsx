'use client';

import { useEffect } from 'react';
import type { ThemeConfig } from '@/types';

/**
 * Thin ThemeProvider — reads a theme config object and sets CSS variables.
 * That's it. No context wrappers, no database reads, no font management.
 */
export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeConfig;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const c = theme.colours;

    root.style.setProperty('--primary', c.primary);
    root.style.setProperty('--secondary', c.secondary);
    root.style.setProperty('--muted', c.muted);
    root.style.setProperty('--accent-gold', c.accentGold);
    root.style.setProperty('--accent-cyan', c.accentCyan);
    root.style.setProperty('--accent-green', c.accentGreen);
    root.style.setProperty('--accent-magenta', c.accentMagenta);
    root.style.setProperty('--background-dark', c.backgroundDark);
    root.style.setProperty('--background', c.background);
    root.style.setProperty('--foreground', c.foreground);
  }, [theme]);

  return <>{children}</>;
}
