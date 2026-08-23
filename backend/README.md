# AvhiSafe MongoDB Backend

This folder contains the standalone backend service for AvhiSafe’s per-user AI dashboard system. The frontend remains in the repository root, while this service owns authenticated dashboard configuration, widget layouts, AI request history, revisions, permissions, connected wallet metadata, and public portfolio metadata.

## MongoDB setup

Copy `.env.example` to `.env` and configure a MongoDB connection:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=avhisafe
```

MongoDB Atlas connection strings are also supported. Do not commit `.env` files.

## Run the backend

```bash
cd backend
npm install
npm run dev
```

The default server port is `4000`.

For a production-style build:

```bash
npm run lint
npm run build
npm start
```

Create the recommended indexes after MongoDB is configured:

```bash
npm run db:indexes
```

## Per-user document boundaries

Every user-owned document contains a `userId`. Dashboard reads and writes must always filter by both the authenticated user and the requested document ID. This prevents a user from reading or changing another user’s dashboard.

| Collection | Purpose |
|---|---|
| `users` | Account identity and role |
| `dashboards` | Personal dashboard name, theme, currency, filters, and widget layout |
| `dashboard_revisions` | Manual and AI-generated dashboard snapshots for undo/history |
| `ai_requests` | User prompts, AI plan status, and structured responses |
| `feature_permissions` | Per-user feature enablement and configuration |
| `connected_wallets` | Public MetaMask/EVM and Solana wallet metadata |
| `public_addresses` | Watch-only and generated public addresses |
| `portfolio_snapshots` | Historical read-only portfolio values |

## Current API

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness check; does not require MongoDB |
| `GET /ready` | MongoDB readiness check |
| `GET /api/v1/dashboards` | List the authenticated user’s dashboards |
| `POST /api/v1/dashboards` | Create a user-owned dashboard |
| `GET /api/v1/workspace` | Load the default dashboard and related user-owned metadata |
| `PATCH /api/v1/dashboards/:dashboardId` | Update a dashboard and create a revision |
| `GET /api/v1/dashboards/:dashboardId/revisions` | Read that dashboard’s revision history |
| `POST /api/v1/ai/requests` | Store a user-scoped AI customization request for planning |

The current development authentication boundary uses `x-user-id` only to exercise ownership-aware routes. It is not production authentication. Before deployment, replace it with real session or OAuth middleware and derive the user ID server-side rather than trusting a client-provided header.

The AI request endpoint currently stores a structured request record. The next step is to connect a server-side AI planner that returns allowlisted widget operations, validates them, previews the result, and applies changes only after user approval.

AvhiSafe never sends private keys or recovery phrases to this backend or to the AI. Only dashboard configuration and public blockchain metadata belong in MongoDB.
