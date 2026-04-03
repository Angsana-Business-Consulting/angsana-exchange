'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';
import { navigationItems } from '@/config/navigation';
import { defaultTheme } from '@/config/theme';
import { cn } from '@/lib/utils';

/**
 * Icon lookup — maps string names from nav config to Lucide components.
 * Add icons here as new modules are added to navigation.ts.
 */
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  ClipboardCheck,
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col bg-[var(--primary)] text-white">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <Image
          src={defaultTheme.logoReversedPath}
          alt={defaultTheme.name}
          width={160}
          height={40}
          className="h-8 w-auto"
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="mt-6 flex-1 px-3">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = iconMap[item.icon];
            const isActive = pathname === item.route;

            return (
              <li key={item.route}>
                <Link
                  href={item.route}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {Icon && <Icon className="h-5 w-5 shrink-0" />}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-6 py-4">
        <p className="text-xs text-white/50">
          {defaultTheme.name} Exchange
        </p>
      </div>
    </aside>
  );
}
