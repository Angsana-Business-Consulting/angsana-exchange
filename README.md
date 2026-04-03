# Angsana Exchange

Client-facing platform for Angsana LGaaS — the single destination for all client engagement.

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **Firebase Auth** + JWT custom claims
- **Firestore** (angsana-exchange GCP project)
- **Cloud Run** deployment

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Firebase service account key (for local development)

### Setup

```bash
# Clone
git clone https://github.com/keithnew/angsana-exchange.git
cd angsana-exchange

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Firebase config values

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `angsana-exchange` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account key JSON (local dev only) |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/login/       # Login page
│   ├── (dashboard)/        # Authenticated dashboard shell
│   │   ├── page.tsx        # Dashboard home (Looker embeds — Phase 1)
│   │   └── approvals/      # Target list approvals (Phase 2)
│   └── api/auth/session/   # Session management API
├── components/
│   ├── layout/             # Sidebar, Header
│   └── ui/                 # shadcn/ui primitives (Button, Card, Input)
├── config/
│   ├── navigation.ts       # Static nav config
│   └── theme.ts            # Angsana brand theme
├── lib/
│   ├── firebase/           # Client + Admin SDK init
│   ├── theme/              # ThemeProvider
│   └── utils.ts            # cn() utility
├── middleware.ts            # JWT validation (stub)
└── types/                  # AuthClaims, NavItem, ThemeConfig
```

## Deployment

Built for Cloud Run with standalone Next.js output:

```bash
# Build
npm run build

# Docker build
docker build -t angsana-exchange .

# Run locally
docker run -p 8080:8080 angsana-exchange
```

## Logo Files

Place brand assets in `public/brand/`:
- `logo-horizontal.png` — Full horizontal lock-up (sidebar header)
- `mark.png` — Compact mark (favicon, collapsed state)
- `logo-reversed.png` — White/reversed version (dark backgrounds)

## Architecture

See `docs/architecture/` for:
- [Technology Stack](docs/architecture/technology-stack.md)
- [White-Label Notes](docs/architecture/white-label-notes.md) (future reference)

## GCP Project

| Property | Value |
|----------|-------|
| Project ID | `angsana-exchange` |
| Region | `europe-west2` (London) |
| Firestore | Standard edition, `(default)` database |
| Auth | Email/Password enabled |
