# Prospecting Rules Step 1 — Post-Testing Fixes

## Priority: Fix all before moving to Step 2

---

## Fix 0 (CRITICAL): Layout regression — horizontal overflow on all pages

**Problem:** Every page in the application now extends wider than the browser viewport, causing a horizontal scrollbar on the browser window. This affects Campaigns, Prospecting Profile, Exclusions, Check-ins, Actions, Wishlists, So Whats, Documents, DNC/MSA-PSL, Settings, Portfolio, Managed Lists, My Clients, Users — all pages, including detail pages. This was NOT happening before the Step 1 build.

**This is a layout-level regression** introduced during the Step 1 changes. Since it affects every page (not just Exclusions), the cause is in a shared layout component — not in the Exclusions page itself.

**Where to look:**

1. **The root layout or main content wrapper.** Check `src/app/(dashboard)/layout.tsx` or equivalent. Look for any changes made during this build — a removed `overflow-x: hidden`, a removed `max-width`, a removed `w-full`, or a change to the flex/grid structure.

2. **The sidebar component.** If the sidebar width or positioning changed when adding the ExpandableNavGroup, it may have shifted the content area calculation. Check if the sidebar has a fixed width and the main content uses `flex-1` or `calc(100% - sidebarWidth)`.

3. **Use git diff** to see exactly what changed in layout files during this build:
   ```bash
   git diff HEAD~1 -- src/app/\(dashboard\)/layout.tsx src/components/nav/ src/components/layout/
   ```

**Fix:** Restore the layout constraint that was in place before. The main content area should:
- Never exceed the remaining viewport width after the sidebar
- Have `overflow-x: hidden` or `overflow-x: auto` on the content container (not the body)
- Use `min-width: 0` on flex children if using flexbox (prevents flex items from overflowing)

**Test:** After fixing, check ALL pages — Campaigns, Portfolio, Documents, Exclusions, detail pages — confirm no horizontal scrollbar on the browser window at standard desktop width (1280px+).

---

## Fix 1: Seed script overwrites client config — change to merge pattern

**Problem:** Running the seed script overwrites the entire client config document, destroying fields that were added after initial seeding (e.g. `driveFolderId`, `driveId`, `driveProvisionStatus`, `folderMap`, `driveProvisionedAt`, `driveProvisionedBy`). This happened when the seed script was extended to add exclusion data — it re-seeded the Cegid Spain client config and wiped the Drive configuration.

**Fix:** Change the seed script (`scripts/seed.ts`) to use `set` with `{ merge: true }` for all client config documents. This adds/updates the fields the seed defines without touching fields it doesn't know about.

**Before (destructive):**
```typescript
await clientConfigRef.set({
  name: "Cegid Group Spain",
  tier: "premium",
  status: "active",
  // ... seed fields only
});
```

**After (safe merge):**
```typescript
await clientConfigRef.set({
  name: "Cegid Group Spain",
  tier: "premium",
  status: "active",
  // ... seed fields only
}, { merge: true });
```

**Apply this to ALL client config `set()` calls in the seed script** — cegid-spain, test-provision, wavix, and any future clients.

**For sub-collections** (exclusions, soWhats, wishlists, actions, checkIns): these are less risky since they create individual documents. But add a check-before-write guard to avoid duplicating seed data on re-run:

```typescript
const existingDoc = await docRef.get();
if (!existingDoc.exists) {
  await docRef.set(seedData);
}
```

**Immediate manual fix needed:** Restore the `driveFolderId` field on cegid-spain's client config via the Firestore console:
- Field: `driveFolderId`  
- Type: string  
- Value: `1ZlJtt0G2-N2L9n_s36dpY-fyJHbu4Yik`

Test-provision is unaffected (its Drive config survived because it wasn't in the seed data).

---

## Fix 2: Font size consistency across Exclusions table columns

**Problem:** The Scope Detail, Reason, and Added columns use a smaller font size than the Company column. All data columns should use the same base font size.

**Fix:** In `ExclusionsClient.tsx`, ensure all table cell text uses the same size class (match Company column). Secondary text lines (e.g. "by Keith New", "Juan Pérez — Area Manager") should remain smaller/muted — that's intentional.

---

## Fix 3: Reason filter not loading managed list values + reason column showing raw keys

**Problem:** Two related issues:
1. The Reason filter dropdown only shows "All reasons" and "No reason given" — not the 8 managed list values.
2. The Reason column shows raw keys like "active-client" and "client-request" instead of display names like "Active client relationship" and "Client request".

**Fix:** Both issues are caused by the same thing — the exclusionReasons managed list is not being fetched.

1. Fetch `tenants/angsana/managedLists/exclusionReasons` (active items only) when the Exclusions page loads
2. Build a lookup map: `{ "active-client": "Active client relationship", ... }`
3. Use the map to:
   - Populate the Reason filter dropdown: "All reasons" → each display name → "No reason given"
   - Resolve display names in the Reason table column

Look at how other pages fetch managed lists (e.g. campaign create form fetching serviceTypes) and follow the same pattern.

---

## Fix 4: Search filter returning incorrect results

**Problem:** Typing "se" in the search box shows entries that don't contain "se" (e.g. CAMPER, COOSY, DÉCIMAS). The search appears to be filtering on the wrong field or the filter conditions are interfering with each other.

**Fix:** Check the search/filter logic in `ExclusionsClient.tsx`. The search should:

1. Filter across `companyName`, `contactName`, and `notes` fields using case-insensitive `includes()`
2. Work from the first character — no minimum length threshold
3. Apply independently alongside other filters (scope, reason, status) as AND conditions
4. Not accidentally filter on scope, status, or any other field

Debug approach: add a `console.log` in the filter function showing each entry and whether it passes the search test. The bug will be immediately visible.

---

## Fix 5: Remove "DNC / MSA-PSL" nav item from sidebar

**Problem:** The sidebar still shows "DNC / MSA-PSL" below Documents. This is superseded by Prospecting Rules (Exclusions, Conflicts, Relationships).

**Fix:** Remove the "DNC / MSA-PSL" entry from the sidebar navigation config. The placeholder route pages can remain — just remove the nav item.

---

## Implementation Order

1. **Fix 0** — layout regression (CRITICAL — affects entire application)
2. **Fix 1** — seed script merge pattern (prevents future data loss)
3. **Fix 3** — reason managed list fetch (fixes both filter and display name)
4. **Fix 2** — font size consistency (quick CSS fix)
5. **Fix 4** — search filter logic (small bug)
6. **Fix 5** — remove DNC/MSA-PSL nav item (2 minutes)

---

## Definition of Done

- **AC0:** No horizontal scrollbar on any page at standard desktop width (1280px+). Check Campaigns, Portfolio, Documents, Exclusions, and at least one detail page.
- **AC1:** Re-running the seed script does not overwrite existing client config fields (e.g. Drive configuration). Verify by checking cegid-spain config still has `driveFolderId` after a seed re-run.
- **AC2:** All Exclusions table columns (Company, Scope, Scope Detail, Reason, Added) use the same base font size.
- **AC3:** Reason filter dropdown shows all 8 managed list display names plus "No reason given". Selecting a reason correctly filters the table.
- **AC4:** Reason column shows human-readable display names (e.g. "Active client relationship") not raw keys.
- **AC5:** Search for "se" returns only Seidor (and any other entries containing "se" in company name, contact name, or notes). Search works from the first character.
- **AC6:** "DNC / MSA-PSL" nav item no longer appears in the sidebar.
