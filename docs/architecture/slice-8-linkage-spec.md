# Slice 8 — Campaign–Proposition Linkage

## Status: Implemented

## What This Slice Delivers

1. **Campaign–Proposition linkage**: Every campaign can reference one or more propositions via `propositionRefs` (string array of proposition document IDs). Campaign targeting fields are constrained to the ICP values defined on the selected proposition(s).

2. **Bidirectional navigation**: 
   - Campaigns show which propositions they belong to (clickable links on detail page)
   - Propositions show which campaigns are associated (in expanded card view, clickable links)
   
3. **Prospecting Profile UI consolidation**: The two-list layout (Propositions + separate ICP) is replaced with unified proposition cards where each card contains its ICP as an expandable section, plus associated campaigns.

## Data Model Changes

### Campaign Entity — New Field
| Field | Type | Description |
|-------|------|-------------|
| `propositionRefs` | `string[]` (optional) | Array of proposition document IDs. Required before draft→active transition. |

### Proposition Entity — New Field  
| Field | Type | Description |
|-------|------|-------------|
| `icpStatus` | `'draft' \| 'active'` | Indicates whether ICP is reviewed. Default: `'draft'`. |

### Firestore Paths (unchanged)
- Propositions: `tenants/{tenantId}/clients/{clientId}/propositions/{propositionId}`
- Campaigns: `tenants/{tenantId}/clients/{clientId}/campaigns/{campaignId}`

## Campaign Targeting Constraint Logic

When a proposition is selected on a campaign:
1. The system loads the proposition's ICP
2. Targeting fields constrain to ICP values (narrow but not expand)
3. If ICP has no values for a dimension, falls back to full managed list
4. Changing proposition highlights out-of-scope values with amber warnings

## UI Changes

### Prospecting Profile Page
- Unified proposition cards with expandable ICP sections
- ICP status dot + badge (green=active, amber=draft, grey=none)
- Campaign count pill per proposition (clickable to expand)
- Associated campaigns list within expanded card
- "+ Create Campaign" link pre-populates proposition
- Inline proposition edit (edit form appears within the card, not at page bottom)

### Campaign Form (Create/Edit)
- Proposition multi-select (checkboxes) with ICP constraint logic
- Targeting fields constrained when propositions selected
- Amber warnings for out-of-scope targeting values

### Campaign Detail Page
- Linked Propositions card with clickable links to Prospecting Profile
- ICP summary showing aggregated targeting from linked propositions

### Campaign List Page
- Proposition names shown as subtitle below campaign name

## Seed Data
- Cegid Spain campaigns linked to appropriate propositions
- `icpStatus` set on existing propositions

## Files Modified
- `src/types/index.ts` — Added `propositionRefs` to Campaign, `icpStatus` to Proposition
- `scripts/seed.ts` — Proposition-campaign linkage seed data
- `src/app/(dashboard)/clients/[clientId]/prospecting-profile/ProspectingProfileClient.tsx` — Unified cards UI
- `src/app/(dashboard)/clients/[clientId]/campaigns/CampaignForm.tsx` — Proposition selector + constraints
- `src/app/(dashboard)/clients/[clientId]/campaigns/[campaignId]/CampaignDetailClient.tsx` — Proposition display
- `src/app/(dashboard)/clients/[clientId]/campaigns/CampaignTable.tsx` — Proposition column
- `src/app/(dashboard)/clients/[clientId]/campaigns/page.tsx` — Pass propositions to table
- `src/app/(dashboard)/clients/[clientId]/campaigns/new/page.tsx` — Query param support
- `src/app/api/clients/[clientId]/campaigns/route.ts` — Save propositionRefs
- `src/app/api/clients/[clientId]/campaigns/[campaignId]/route.ts` — Save propositionRefs
- `src/app/api/clients/[clientId]/propositions/[id]/route.ts` — Save icpStatus
- `src/app/(dashboard)/clients/[clientId]/prospecting-profile/page.tsx` — Pass campaigns to profile
