# Slice 8 — Client Prospecting Profile (CPP)

Spec saved from: `/Users/keith.new/Downloads/angsana-exchange-slice-8-cpp.docx`

See the original docx for the full specification. This markdown file serves as a reference marker.

## Implementation Status

### ✅ Completed
1. **TypeScript types** — Proposition, ProspectingProfile, ICP, MarketMessagingEntry, Recommendation, AIReview added to `src/types/index.ts`
2. **Propositions API** — GET/POST at `/api/clients/[clientId]/propositions`, PATCH/DELETE at `/api/clients/[clientId]/propositions/[id]`
3. **Prospecting Profile API** — GET at `/api/clients/[clientId]/prospecting-profile`, PATCH routes for ICP, market-messaging, recommendations sections
4. **AI Review endpoint** — POST returns 501 Not Implemented placeholder
5. **Document proposition tagging API** — PATCH at `/api/clients/[clientId]/documents/[documentId]/proposition`
6. **CPP Page** — Server component (`page.tsx`) fetches all data; Client component (`ProspectingProfileClient.tsx`) renders all 5 sections
7. **Navigation** — "Prospecting Profile" added to sidebar after "So Whats"
8. **Managed list types** — `propositionCategories` and `messagingTypes` types and config added

### 🔲 Remaining (follow-up session)
1. **Seed script** — Add propositionCategories, messagingTypes managed lists; Cegid Spain propositions + profile; Test Provision Client data
2. **Admin Managed Lists page** — Add propositionCategories and messagingTypes tabs to ManagedListsClient.tsx
3. **Campaign form changes** — Add propositionRefs multi-select to CampaignForm.tsx, campaign detail chips
4. **Documents page changes** — Proposition filter dropdown, three-dot menu "Link to proposition", mauve pills
5. **Polish** — Loading skeletons, ICP seniority field in edit mode, per-section last-updated display refinement
