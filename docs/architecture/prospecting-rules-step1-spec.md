# Prospecting Rules — Step 1: Expandable Nav + Exclusions Collection + List Page

**Prepared by:** Keith / Claude  
**Date:** 14 April 2026  
**Status:** Implemented  
**Depends on:** Slice 8 complete, deployed  

## What This Step Delivers

Four deliverables that ship together:

1. **Expandable parent nav component** — establishes the pattern for sidebar items that have children. Prospecting Rules appears as an expandable group with Exclusions as its first child. Conflicts and Relationships show as "Coming soon" placeholders.

2. **Exclusions Firestore collection** — data model, TypeScript types, API route for read operations, and seed data for Cegid Spain.

3. **Exclusions list page** — table view at `/clients/{clientId}/exclusions` with scope/reason/status filters, role-based visibility, and seed data rendered.

4. **exclusionReasons managed list** — new managed list seeded with initial values, visible in admin Managed Lists page.

## Files Created/Modified

| File | Purpose |
|------|---------|
| `src/components/nav/ExpandableNavGroup.tsx` | Generic expandable nav group with chevron toggle |
| `src/config/navigation.ts` | Updated with Prospecting Rules group (Exclusions, Conflicts placeholder, Relationships placeholder) |
| `src/components/layout/Sidebar.tsx` | Updated to render expandable groups from nav config |
| `src/types/index.ts` | Added ExclusionEntry, ExclusionScope, ExclusionStatus, EXCLUSION_SCOPE_CONFIG, NavChildItem |
| `src/app/api/clients/[clientId]/exclusions/route.ts` | GET handler with status, scope, reason, search filters |
| `src/app/(dashboard)/clients/[clientId]/exclusions/page.tsx` | Server component |
| `src/app/(dashboard)/clients/[clientId]/exclusions/ExclusionsClient.tsx` | Client component with filters, table, summary bar |
| `src/app/(dashboard)/clients/[clientId]/conflicts/page.tsx` | Placeholder — "Coming soon" |
| `src/app/(dashboard)/clients/[clientId]/relationships/page.tsx` | Placeholder — "Coming soon" |
| `firestore.indexes.json` | Added composite index for exclusions collection |
| `scripts/seed.ts` | Extended with exclusionReasons managed list + 12 Cegid Spain exclusion entries |

## What This Step Does NOT Include

- Create/edit forms — Step 2
- Remove/soft-delete functionality — Step 2
- CSV download/upload — Step 3
- Conflicts collection and page — Step 4
- Relationships collection and page — Step 6
