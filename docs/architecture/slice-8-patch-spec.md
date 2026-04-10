# Slice 8 Patch — CPP Restructure & Fixes

**Status:** Ready for implementation  
**Depends on:** Slice 8 CPP (deployed)  
**Date:** 10 April 2026  

## Overview

Seven changes to the Slice 8 CPP implementation. The most significant is moving ICP from the prospectingProfile document into each proposition.

### Changes

1. **Move ICP into propositions** (data restructure)
2. **Resolve UIDs to display names** on proposition and recommendation cards
3. **Client-approver can create propositions** (draft status, auto-action)
4. **Buying process types as a managed list**
5. **Show creator/updater names and dates** on recommendation cards
6. **Proposition → Campaign cross-links** on CPP page
7. **Documents campaignRef → campaignRefs** (array, multi-tag support)

---

## Change 1: Move ICP into Propositions

### Why
A client with multiple propositions targets different people with each. One broad ICP covering all propositions is too general.

### Data model change

**Before:**
- `tenants/{tenantId}/clients/{clientId}/prospectingProfile.icp` → single ICP object
- `tenants/{tenantId}/clients/{clientId}/propositions/{propositionId}` → no ICP

**After:**
- `tenants/{tenantId}/clients/{clientId}/prospectingProfile` → no ICP section (removed)
- `tenants/{tenantId}/clients/{clientId}/propositions/{propositionId}.icp` → ICP object per proposition

The prospectingProfile document retains: marketMessaging, recommendations, aiReview, lastUpdatedBy, lastUpdatedAt.

### Proposition document schema (updated)

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto) | Firestore document ID |
| name | string (required) | Max 80 characters |
| category | string (ref) | propositionCategories managed list reference |
| description | string (optional) | Max 280 characters |
| status | enum | draft / active / inactive |
| sortOrder | number | Default: 0 |
| icp | object (optional) | ICP for this proposition. Same schema as original Slice 8 Section 3.2 |
| suggestedCategory | string (optional) | Free-text category suggestion from client-approver |
| createdBy | string | UID of creator |
| createdAt | timestamp | Creation timestamp |
| lastUpdatedBy | string | UID of last editor |
| lastUpdatedAt | timestamp | Last modification timestamp |

### API route changes

- **Remove:** `PATCH /api/clients/[clientId]/prospecting-profile/icp`
- **Add:** `PATCH /api/clients/[clientId]/propositions/[id]/icp` — updates ICP on a proposition. Internal users and client-approver. Client-approver saves trigger auto-action.
- **Modify:** `GET /api/clients/[clientId]/prospecting-profile` — no longer includes `icp` field.

### CPP page UI changes

The standalone ICP section card is removed. Each proposition card becomes expandable:
- **Collapsed:** Name, description preview, category, status badge, campaign count, metadata
- **Expanded:** All above + full ICP form (industries, company sizing, titles, seniority, buying process, geographies, exclusions)

Edit behaviour: clicking edit opens both proposition header fields AND ICP fields. ICP fields in visually distinct sub-section (background #F5F9FA, left border accent). Single save writes both.

Empty ICP state: "No targeting profile defined yet — click edit to add ICP details."

### Seed data

- **ERP Solutions:** Inherits existing full ICP
- **Retail POS:** Industries: Retail & Consumer. Specifics: "Multi-site retail chains, 20+ stores." Sizing: revenue £20M–£200M. Titles: Head of Retail Operations, IT Director. Buying: single-decision-maker. Geographies: UK.
- **HR & Payroll:** Industries: Professional Services, Financial Services. Sizing: headcount 500–5,000. Titles: HR Director, Head of People, CFO. Buying: committee. Geographies: UK. Specifics: "Mid-market enterprises modernising from legacy payroll systems."
- Remove ICP from Cegid prospectingProfile document.
- Test Provision Client gets empty ICP object.

---

## Change 2: Resolve UIDs to display names

Build a UID-to-name lookup map from the tenant's users collection, pass as prop to client component.

Display format:
- Bottom of each proposition card: "Added by [displayName] on [date]" (muted, 12px)
- If updated: "Updated by [displayName] on [date]"
- Unresolvable UIDs: show "Unknown"
- Same pattern for recommendation cards (Change 5)

---

## Change 3: Client-approver can create propositions

### New status: draft
- `draft` / `active` / `inactive`
- **draft:** Created by client-approver. Amber badge. Not in campaign pickers.
- **active:** Green badge. In campaign pickers.
- **inactive:** Grey badge. Hidden from pickers.

### Client-approver create flow
- "+ Suggest Proposition" button (not "+ Add Proposition")
- Form: name (80 char), category dropdown, description (280 char)
- Below category: free-text "Can't find the right category? Suggest one:" (280 char) → `suggestedCategory` field
- Save: status: draft. Auto-action for AM: "Client suggested new proposition: [name] — review and approve."
- Client-approver can edit name, description, suggestedCategory of own drafts. Cannot change status or edit active/inactive.
- **Clarification (confirmed):** Client-approvers CAN add ICP data to their own draft propositions.

### Internal user promotion
- "Promote to Active" action (green checkmark/button)
- Sets status to active, clears suggestedCategory if proper category assigned

---

## Change 4: Buying process types as managed list

**Path:** `tenants/{tenantId}/managedLists/buyingProcessTypes`

**Seed values:**
1. Single Decision-Maker
2. Committee
3. Procurement-Led
4. Consensus

Implementation:
- Add to ManagedListName enum and MANAGED_LIST_CONFIG
- Add tab on admin Managed Lists page
- ICP buyingProcess.type changes from hardcoded enum to managed list reference (string)
- ICP form dropdown populates from managed list
- TypeScript: ICP.buyingProcess.type becomes `string` (not union type)

---

## Change 5: Recommendation card metadata

Each recommendation card shows:
- "Added by [displayName] on [date]" — muted, 12px
- If edited: "Updated by [displayName] on [date]"
- Uses UID-to-name lookup from Change 2
- Date format: "10 Apr 2026"

---

## Change 6: Proposition → Campaign cross-links

### Data fetching
Client-side filter: fetch all non-completed campaigns, filter where propositionRefs contains proposition ID.

### UI
- Count badge next to status badge: "2 campaigns" / "No campaigns" (muted)
- Clicking expands to show campaign name chips (linked to campaign detail)
- Teal tag chip style
- Collapsed: just count. Expanded: full chip list.

---

## Change 7: Documents campaignRef → campaignRefs

### Schema change

| Before | After | Notes |
|--------|-------|-------|
| `campaignRef: string \| null` | `campaignRefs: string[]` | Array. Default: `[]` |

### Backward compatibility
- Reading: if `campaignRef` (string) but no `campaignRefs` (array), treat as `campaignRefs: [campaignRef]`
- Writing: always write `campaignRefs` (array). Delete old `campaignRef` field (FieldValue.delete())
- Normalisation helper for all code paths

### API changes
- `PATCH .../documents/[documentId]/campaign` — body changes to `{ campaignRefs: string[] }`. Empty array clears all.
- `GET .../documents/browse` — `?campaign=` filter uses `array-contains` instead of `==`
- Campaign Documents card — query uses `array-contains` on `campaignRefs`

### UI changes
- "Link to campaign" three-dot menu → multi-select checkbox list
- Multiple teal campaign pills on file rows
- Campaign filter dropdown unchanged (single select, array-contains query)

### Firestore indexes
- Add composite: `documents(campaignRefs ARRAY_CONTAINS, folderCategory ASC)`

---

## Implementation order

1. TypeScript types
2. Managed lists (buyingProcessTypes)
3. ICP restructure (move into propositions, API routes)
4. CPP page — propositions with ICP (expandable cards)
5. Client-approver proposition creation (draft, suggestedCategory, promote)
6. UID resolution (lookup map, display names)
7. Proposition → Campaign cross-links
8. campaignRefs migration (schema, backward compat, API, UI, index)
9. Seed data update
10. Polish

---

## Definition of done

- AC1–AC3: ICP per proposition, editing, empty states
- AC4–AC6: Client-approver draft propositions, auto-actions, promotion
- AC7: buyingProcessTypes managed list
- AC8–AC9: UID resolution on proposition and recommendation cards
- AC10: Proposition → campaign cross-links
- AC11–AC13: Document multi-campaign tagging, backward compat
