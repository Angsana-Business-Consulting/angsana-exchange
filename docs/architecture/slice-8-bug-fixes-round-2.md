# Slice 8 — Bug Fixes and Polish (Round 2)

## Priority: Fix all issues before moving to next slice

These are specific bugs and inconsistencies found during testing of the Campaign–Proposition linkage and UI consolidation work. Each fix is described with the problem, the expected behaviour, and the specific file(s) likely involved.

---

## Sticky Sub-Header Fixes

### Fix 1: Sub-header border does not span full width

**Problem:** The line under the sticky sub-header (showing the campaign/item name when scrolled) does not extend all the way across the page. It stops short, leaving gaps on one or both sides.

**Expected:** The bottom border of the sticky sub-header should span the full width of the content area, edge to edge, matching how the main top header bar's bottom border works.

**Fix:** Find the sticky sub-header component (likely in the campaign detail page layout or a shared layout component). The border-bottom CSS needs `width: 100%` and the sub-header container must not have horizontal padding that prevents the border from reaching the edges. If the sub-header is inside a padded container, the border should be applied via a pseudo-element or the container should use negative margins to extend the border, or move the border to a wrapper that sits outside the padding.

**Test:** Scroll down on any campaign detail page. The sub-header line should be a continuous line from left edge to right edge of the content area with no gaps.

### Fix 2: Sub-header visual glitch when scrolling up then down

**Problem:** When scrolling the page down, the sub-header appears correctly pinned below the main header. But when the user scrolls up slightly and then back down, the sub-header slides down below the main header creating a visible sliver of white space between the two bars, then snaps back into position. This looks jittery and unpolished.

**Expected:** The sub-header should be pinned with `position: sticky` and a `top` value that places it exactly below the main header with zero gap. There should be no visual jump or white space at any point during scrolling in any direction.

**Fix:** This is likely caused by the `top` value on the sticky sub-header not matching the exact height of the main header, OR by a scroll event listener adjusting the position dynamically (which causes the jitter). The correct approach:

1. The main top header bar should have a fixed, known height. Set this as a CSS variable if it isn't already: `--header-height: 64px` (or whatever the actual height is).
2. The sticky sub-header should use `position: sticky; top: var(--header-height); z-index: 39;` (one less than the main header's z-index).
3. Do NOT use JavaScript scroll listeners to show/hide or reposition the sub-header. Pure CSS `position: sticky` handles this correctly without jitter.
4. The sub-header should have `background: white` (or the page background colour) so content scrolling behind it is not visible.
5. Make sure there is no `margin-top` or `padding-top` on the sub-header that creates the gap. The sub-header's top edge should sit flush against the main header's bottom edge when pinned.

**Test:** On a campaign detail page with enough content to scroll:
- Scroll down smoothly — sub-header appears and pins below the main header with no gap
- Scroll up slightly, then down again — no white space flash, no jitter, no sliding
- Scroll rapidly up and down — stays stable

### Fix 3: Sub-header shifts position when scrolling up

**Problem:** When scrolling the page upward, the sub-header moves up a few pixels before the main content catches up. This is related to the vertical space reduction Keith requested (making header + sub-header take less total space), which may have introduced a dynamic height change or transition.

**Expected:** The sub-header position should be static relative to the main header. It does not move independently. When pinned, it stays pinned at exactly `top: var(--header-height)`. When not pinned (scrolled back to the top of the page), it sits in its natural document flow position.

**Fix:** Remove any CSS transitions on the sub-header's `top`, `height`, `padding`, or `transform` properties. Sticky elements should not animate — they should snap. If there's a `transition: all` or similar on the sub-header, remove it or scope it to only the properties that should animate (like `opacity` if fading in, which is also not needed here).

Also check: if the main header itself changes height when scrolling (e.g., a compact mode), that will cause the sub-header's `top` anchor to shift. If this is happening, the main header height should be constant, not dynamic. A fixed header that changes size on scroll creates cascading layout problems.

**Test:** Same scrolling tests as Fix 2. The sub-header should feel rock-solid — no sliding, no shifting, no transitions.

---

## Campaign Edit Form Fixes

### Fix 4: Edit form layout inconsistent with detail view

**Problem:** The campaign detail page now has the "Linked Propositions" section as its own card below the Campaign Summary card, which is a good layout. But the campaign edit form does not mirror this structure — the proposition selector is positioned differently from how the propositions display on the detail view. When users switch between viewing and editing, the layout feels inconsistent.

**Expected:** The edit form should mirror the visual structure of the detail page as closely as possible. When a user clicks "Edit", the content should transform in place rather than rearranging.

**Fix:** Restructure the campaign edit form to match the detail page's card layout:

1. **Campaign Details card** — Campaign Name, Summary, Service Type, Owner, Start Date, Company Size (same fields as the Campaign Summary card on the detail page)
2. **Propositions card** — The proposition multi-select picker. Show currently linked propositions with their ICP summary. This should be its own visual section/card, matching how "Linked Propositions" appears on the detail page.
3. **Targeting card** — Target Geographies, Target Sectors, Target Titles (constrained by ICP from linked propositions). This mirrors the "Targeting" card on the detail page.
4. **Messaging card** — Elevator Pitch/Value Proposition, Pain Points, So Whats picker. This mirrors the "Messaging" card on the detail page.

The card order on the edit form should match the card order on the detail page exactly. The user should feel like the detail page "opened up" for editing, not like they navigated to a different layout.

**Test:** Open a campaign detail page, note the card order. Click Edit. The edit form should have the same card structure in the same order. Click Cancel/Back — the detail page should feel like the same layout with fields becoming read-only again.

### Fix 5: Save and Cancel buttons at top and bottom of page

**Problem:** The campaign edit form only has Save and Cancel buttons at the bottom. The form is long enough that users have to scroll to the bottom to save, which is friction — especially if they only changed one field near the top.

**Expected:** Save Changes and Cancel buttons should appear at both the top and bottom of the form, like Salesforce does.

**Fix:** Add a button bar at the top of the edit form (below the "Edit: Campaign Name" header and back link, above the first card) with the same Save Changes and Cancel buttons that appear at the bottom. Both button bars trigger the same form submission.

Styling: the top button bar should be visually lighter than the bottom one — perhaps just the buttons right-aligned in a row without a full-width background bar, so it doesn't feel heavy. The bottom button bar can remain as-is.

Consider: if the sticky sub-header is showing the campaign name, the top buttons could be incorporated into the sub-header when in edit mode. This would keep them always visible. But this is a nice-to-have — having them at top and bottom of the form is the priority.

**Test:** Open campaign edit form. Save/Cancel buttons visible at the top without scrolling. Scroll to bottom — Save/Cancel buttons visible. Both sets work identically.

---

## Prospecting Profile Page Fixes

### Fix 6: Campaign links should be right-aligned

**Problem:** On the Prospecting Profile page, the campaign count pills (e.g. "1 campaign") float in the horizontal space depending on the length of the ICP summary text in front of them. This looks untidy — the pills shift position from card to card.

**Expected:** Campaign count pills should be right-aligned, pinned to the right side of the card, so they form a consistent vertical line across all proposition cards.

**Fix:** In the ICP summary row (the row that shows "Technology, Retail & Consumer · VP / Director of Operations · UK" and the campaign count), use flexbox with `justify-content: space-between` or position the campaign pill with `margin-left: auto`. The ICP summary text takes up available space on the left, and the campaign pill is pushed to the right edge.

The pattern should be:
```
[grey dot] [ICP summary text ................................] [campaign pill] [chevron]
```

Where the ICP summary text truncates with ellipsis if it's too long, and the campaign pill and chevron are always right-aligned.

**Test:** View the Prospecting Profile page with multiple propositions. All campaign count pills should align vertically on the right side of their cards, regardless of the ICP summary text length.

---

## Documents Section Fixes

### Fix 7: Campaign detail page — Documents card not showing linked documents

**Problem:** The "Iberia Retail POS — Fashion & Luxury" campaign detail page shows a Documents card with "No documents linked to this campaign" even though there are documents linked to it. The documents exist in the Firestore registry with `campaignRef` set, but the campaign detail page is not finding them.

**Expected:** The Documents card on the campaign detail page should query the Firestore `documents` sub-collection filtered by `campaignRef` matching the current campaign ID, and display any matching files grouped by folder.

**Fix:** Check the CampaignDocumentsCard component (likely in `src/components/documents/CampaignDocumentsCard.tsx` or similar):

1. Verify it is querying the correct Firestore path: `tenants/angsana/clients/{clientId}/documents` with a `where('campaignRef', '==', campaignId)` filter.
2. Check that the `campaignRef` values stored on the document registry entries match the campaign document IDs exactly (case-sensitive string match).
3. If the component is calling the browse API endpoint instead of querying Firestore directly, verify the `?campaign={campaignId}` parameter is being passed and handled correctly by the browse route.
4. Check the browse route handler — if campaign filtering was added in the Slice 7A spec but not yet implemented in the actual route code, this would explain the empty result.

Debug approach: use the Firebase console or curl to query `tenants/angsana/clients/cegid-spain/documents` and check which entries have `campaignRef` set and what value it contains. Compare with the actual campaign document ID for "Iberia Retail POS — Fashion & Luxury".

**Test:** Link a document to the Fashion & Luxury campaign (via the Documents page three-dot menu → Link to campaign). Navigate to the campaign detail page. The Documents card should show that document.

### Fix 8: Campaign edit form — Proposition UI not rendering

**Problem:** On the campaign edit form, the area where propositions should be selectable opens up a space (the container renders) but the proposition picker/dropdown content is not visible. The user sees an empty gap where the proposition selector should be.

**Expected:** The proposition section on the campaign edit form should show a multi-select dropdown/picker listing the client's active propositions, grouped by category. Already-linked propositions should appear as selected chips/tags.

**Fix:** This is likely a rendering issue in the proposition selector component on the edit form. Possible causes:

1. **Data not loading:** The component may be trying to fetch propositions but the query is failing silently. Check the browser console for errors when opening the edit form. Verify the API call to fetch the client's propositions is returning data.
2. **Component conditional rendering:** The component may have a conditional that hides the content — e.g., `if (propositions.length === 0) return null` when the data hasn't loaded yet, and it never re-renders when data arrives.
3. **Z-index or overflow issue:** The dropdown content may be rendering behind another element or clipped by an `overflow: hidden` on a parent container. Inspect the DOM to see if the proposition options exist but are not visible.
4. **Height animation:** If the proposition section has an expand/collapse animation and it's animating to height 0, the content would be invisible. Check for CSS transitions on max-height or height.

Debug approach: Open the campaign edit form, inspect the proposition selector area in browser dev tools. Check if the dropdown/picker HTML elements exist in the DOM. Check the browser console for JavaScript errors. Check the Network tab for failed API calls to the propositions endpoint.

**Test:** Open any campaign edit form. The Propositions section should show a working multi-select picker with the client's propositions listed. Selecting/deselecting propositions should work. Linked propositions should show as selected.

---

## Implementation Order

1. **Fix 2 + Fix 3** (sticky sub-header jitter/shift) — these are the same root cause. Fix together. ~30 minutes.
2. **Fix 1** (sub-header border width) — quick CSS fix once the sticky behaviour is stable. ~10 minutes.
3. **Fix 8** (proposition picker not rendering on edit form) — blocking issue, needs debugging. ~1 hour.
4. **Fix 7** (documents not showing on campaign detail) — data/query issue, needs debugging. ~1 hour.
5. **Fix 4** (edit form layout consistency) — UI restructure. ~2 hours.
6. **Fix 5** (save/cancel at top and bottom) — small addition. ~30 minutes.
7. **Fix 6** (right-align campaign pills on Prospecting Profile) — CSS fix. ~15 minutes.

---

## Definition of Done

- **AC1:** Sticky sub-header pins below the main header with no gap, no jitter, no white space flash when scrolling in any direction. Border spans full content width.
- **AC2:** Campaign edit form layout matches the campaign detail page card structure: Campaign Details → Propositions → Targeting → Messaging, in that order.
- **AC3:** Save Changes and Cancel buttons appear at both the top and bottom of the campaign edit form. Both sets function identically.
- **AC4:** Proposition selector on campaign edit form renders correctly — shows client's propositions, allows selection/deselection, displays linked propositions.
- **AC5:** Campaign detail page Documents card shows documents linked to that campaign (files with matching campaignRef). Empty state only when genuinely no documents are linked.
- **AC6:** Prospecting Profile page campaign count pills are right-aligned within proposition cards, forming a consistent vertical line.
