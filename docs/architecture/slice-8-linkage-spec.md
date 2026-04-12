# Slice 8 — Campaign–Proposition Linkage

## Implementation Spec

**Date:** 12 April 2026  
**Status:** In progress  
**Depends on:** Slices 1–7A (complete), Prospecting Profile (complete)

## What This Slice Delivers

1. **Campaign–Proposition linkage** — campaigns reference propositions via `propositionRefs`. The campaign targeting fields are constrained to the proposition's ICP values.
2. **Bidirectional navigation** — campaigns show which propositions they belong to (clickable links). Propositions show which campaigns reference them (clickable links).
3. **Prospecting Profile UI consolidation** — unified proposition cards with expandable ICP sections and campaign lists (replacing separate proposition + ICP lists).

## Data Model Changes

### Campaign — `propositionRefs` field
- Already exists: `propositionRefs: string[]` on Campaign type
- Campaign targeting (geographies, sectors, titles) is constrained to the merged ICP values from linked propositions

### Proposition — `icpStatus` field  
- Already exists: `icpStatus?: ICPStatus` ('draft' | 'active') on Proposition type
- Visual indicator on cards (green dot = active, amber = draft, grey = none)

### ICP — nested on Proposition (`icp?: ICP`)
- `industries.managedListRefs: string[]`
- `titles.managedListRefs: string[]`
- `geographies.managedListRefs: string[]`
- `companySizing: CompanySizingEntry[]`
- `buyingProcess: ICPBuyingProcess`
- `seniority.managedListRefs: string[]`
- `exclusions: ICPExclusion[]`

## Files Modified

### Types
- `src/types/index.ts` — Already has `propositionRefs`, `icpStatus`, `icp` fields

### Campaign Form (ICP Targeting Constraints)
- `src/app/(dashboard)/clients/[clientId]/campaigns/CampaignForm.tsx`
  - Added ICP constraint logic: when propositions are linked, targeting fields show only ICP values
  - Out-of-scope value warnings (amber)  
  - Draft ICP status indicator
  - `initialPropositionId` prop for URL query param pre-population

### Campaign New Page (Query Param Support)
- `src/app/(dashboard)/clients/[clientId]/campaigns/new/page.tsx`
  - Accepts `?proposition={id}` query param
  - Passes `initialPropositionId` to CampaignForm

### Prospecting Profile UI
- `src/app/(dashboard)/clients/[clientId]/prospecting-profile/ProspectingProfileClient.tsx`
  - Unified proposition cards with expandable ICP + campaign sections
  - "+ Create Campaign" link per proposition

## Navigation Chain

```
Proposition card → campaign count pill → expand card → campaign list → click campaign → Campaign Detail
Campaign Detail → proposition name (clickable) → Prospecting Profile page
Campaign List → proposition name column → clickable link
Campaign Create → ?proposition={id} → pre-populated selector
```

## Acceptance Criteria

- AC1: Propositions display as unified cards with ICP as expandable section
- AC2: Collapsed card shows name, description, category, status, icpStatus indicator, campaign count, ICP summary
- AC3: Expanded card shows full ICP fields, ICP status badge, campaigns list
- AC4: "+ Create Campaign" link pre-populates proposition
- AC5: Campaign targeting constrained by linked proposition ICP values
- AC6: Out-of-scope values shown with amber warnings
- AC7: Campaign detail shows proposition name as clickable link
- AC8: Existing campaigns without propositionRef handled gracefully
- AC9: Bidirectional navigation works end-to-end
