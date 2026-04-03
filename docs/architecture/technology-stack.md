# Angsana Exchange — Technology Stack

> **Status:** Agreed | **Date:** 2 April 2026 | **Prepared by:** Keith

This document records the agreed technology stack for Angsana Exchange. Decisions here reflect a considered balance between IP ownership, build speed, existing infrastructure, and the platform's role as a saleable asset within the LGaaS proposition.

---

## What Angsana Exchange Is

Angsana Exchange is the primary client-facing product of the Angsana LGaaS platform. It is the single destination for all client engagement — replacing ad-hoc reporting and communication with a structured, secure, branded experience.

Core modules include:
- Live campaign status and activity dashboards
- Target list review and approval workflows
- Meeting and pipeline views (sourced from Salesforce)
- Embedded Looker reporting and visualisations
- Document and asset access

---

## Agreed Technology Stack

| Component | Technology | Role |
|-----------|-----------|------|
| Framework | Next.js (App Router) | Full-stack React framework. Routing, SSR, API routes, JWT middleware. |
| Language | TypeScript | Typed throughout — frontend, API routes, and service modules. |
| Styling | Tailwind CSS | Utility-first CSS with consistent design system. |
| UI Components | shadcn/ui | Unstyled, accessible React components built on Tailwind. Owned in codebase. |
| Authentication | Firebase Auth + JWT | Firebase Auth handles identity. Custom JWT claims encode clientId, role, permittedModules. |
| Database | Firestore | Dedicated instance in angsana-exchange GCP project. All data scoped by clientId. |
| Reporting | Looker Embed SDK | Visualisations embedded via server-signed URLs from a Cloud Function. |
| Integrations | Cloud Functions | Existing Cloud Functions in angsana-platform proxy Salesforce data. |
| GCP Project | angsana-exchange | Own project — separate IAM, billing, Cloud Run service. |
| Deployment | Cloud Run | Single container deployment. One container, one deploy. |
| Shared libs | angsana-platform monorepo | Exchange consumes shared TypeScript types and service modules as npm packages. |

---

## Authentication & Multi-Tenancy

1. User authenticates via Firebase Auth (email/password or SSO)
2. Cloud Function issues custom JWT claim with `clientId`, `role`, `permittedModules`
3. Next.js middleware validates JWT on every page and API route
4. Firestore security rules enforce clientId scoping as second line of defence
5. Looker embed URLs are server-signed per request

---

## Why This Stack

- **IP Ownership:** Every line of code in our GitHub org. No per-seat licence. MIT-licensed open source.
- **No New Infrastructure:** Sits on existing Firebase Auth, Firestore, Cloud Functions, Cloud Run, Looker.
- **Cloud Run, not Vercel:** Vercel is not in the picture at runtime.

---

## GCP Project Structure

Exchange runs in its own dedicated GCP project (`angsana-exchange`), separate from `angsana-core-prod` and `angsana-platform`. Reasons:

1. **Clean IP boundary** for sale/due diligence
2. **Separate billing visibility** — per-product cost visibility from day one
3. **Independent IAM** — client-facing auth separate from internal ops
4. **White-label optionality** — structural independence enables future licensing

---

## Rejected Alternatives

| Technology | Reason |
|-----------|--------|
| Retool | Per-seat cost, third-party runtime, no IP ownership |
| Custom Node + React SPA | Two deployments, CORS config, more boilerplate |
| Hono + SolidJS | Solves a different problem. Requires platform engineering before client output. |
| Bubble / low-code | Proprietary runtime. Not acquirer-friendly. |
