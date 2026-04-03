import type { NavItem } from '@/types';

/**
 * Static navigation configuration.
 *
 * This is a plain array consumed by the Sidebar component.
 * Today it's a static file. When there are enough tenants to justify
 * dynamic config, promote it to Firestore — same shape, different source.
 */
export const navigationItems: NavItem[] = [
  {
    label: 'Dashboard',
    route: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    label: 'Approvals',
    route: '/dashboard/approvals',
    icon: 'ClipboardCheck',
  },
];
