# Angsana Exchange — White-Label Architecture Notes

> **Status:** Future reference only — NOT current spec
> **Date:** 3 April 2026

These notes describe the **destination** white-label architecture for Angsana Exchange. They are recorded here for future reference. The day-one scaffold builds for one tenant correctly with the right seams so that multi-tenant is a widening of the path, not a rebuild.

---

## What Is In Place Today (Day One)

- CSS variables and semantic tokens — no hardcoded colours
- Theme config as a static object — swap the object, swap the branding
- Navigation config as a static array — same shape whether file-driven or Firestore-driven
- Tenant identity from JWT `clientId` claim — already scoped per client
- Module pages in their own route folders — enabling/disabling is config, not code

---

## Future Evolution (When Needed)

### Tenant Resolution
- Subdomain-based routing (e.g. `clientname.exchange.angsana.com`)
- Fallback to JWT `clientId` for resolution

### Theme System
- Firestore-driven theme config per tenant
- ThemeProvider reads from database instead of static file
- Admin UI for theme management

### Navigation
- Database-driven nav config per tenant
- Role-based and tenant-specific menu overrides

### Feature Flags
- `useFeature()` hook reading from existing Firestore client config
- Per-tenant module enablement
- Label overrides (e.g. "Requests" → "Projects")

---

## Key Principle

> Build for one tenant first, but build it correctly so that multi-tenant is a widening of the path, not a rebuild.

The white-label machinery gets built when there are multiple tenants wanting distinct branding and feature sets. Not before.
