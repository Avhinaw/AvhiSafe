# AvhiSafe Backend

This folder contains the standalone backend service for AvhiSafe’s per-user workspace system. The frontend remains in the repository root, while this service owns database access and future authenticated workspace, AI, and revision APIs.

## Setup

Copy `.env.example` to `.env` and configure `DATABASE_URL` for a MySQL or TiDB database. Do not commit `.env` files.

```bash
cd backend
npm install
npm run build
npm run start
```

The default server port is `4000`.

## Development

```bash
npm run dev
```

## Database migrations

The backend uses the model definitions in `src/schema.ts` and writes migrations to the repository-level `drizzle/migrations` directory.

```bash
npm run db:generate
npm run db:migrate
```

## Current endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness check; does not require a database connection |
| `GET /ready` | Database readiness check |
| `GET /api/v1/workspace` | Reads the authenticated user’s default workspace, widgets, public addresses, and feature permissions |
| `PATCH /api/v1/workspace` | Validates workspace updates but remains disabled until real authentication middleware is connected |

The current development boundary uses an `x-user-id` header only to exercise ownership-aware routing. It is not a production authentication mechanism. Before deployment, replace it with the project’s authenticated session or OAuth middleware and enforce user identity server-side.

The backend never receives wallet private keys or recovery phrases. Only workspace configuration and public blockchain metadata belong in this service.
