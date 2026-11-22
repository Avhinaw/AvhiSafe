# AvhiSafe

AvhiSafe is a non-custodial, read-only crypto portfolio and security command center. Users can sign in with an EVM or Solana wallet, save connected or watch-only public addresses, view portfolio data, protect locally generated wallet material with an encrypted vault, and customize dashboards manually or with a validated AI UI workflow.

AvhiSafe does **not** execute transactions, custody funds, or send private keys and recovery phrases to the backend.

## Current capabilities

- Wallet-based authentication using short-lived server nonces and signed challenges.
- HttpOnly session cookies, session expiry, logout, and session revocation.
- Connected, generated, and watch-only wallet records scoped to the authenticated account.
- EVM and Solana address validation with duplicate-prevention indexes.
- Local AES-GCM encrypted wallet vault with encrypted account backup synchronization.
- Portfolio reads through backend provider adapters with explicit source, timestamp, and error metadata.
- Persisted portfolio snapshots and authenticated historical portfolio data.
- Native balances, token holdings, recent transaction activity, explorer links, QR display, and a local refresh trend chart.
- Multiple dashboards, validated widget configuration, revisions, undo, and AI-generated UI plans.
- Deterministic baseline security scans with evidence-aware results and alert APIs.
- Account data export and authenticated account deletion with session revocation.
- Strict request schemas, security headers, trusted-origin checks, authentication boundaries, ownership checks, and route-level rate limits.

## Repository structure

```text
.
├── app/                  Next.js application routes
├── components/           Dashboard, wallet, vault, and portfolio UI
├── lib/                  Frontend API clients and local vault utilities
├── backend/
│   ├── src/models/       MongoDB document types
│   ├── src/routes/       Auth, wallet, vault, and portfolio routes
│   ├── src/controllers/  Auth and wallet controllers
│   ├── src/middleware/   Authentication, origin, headers, and limits
│   └── src/index.ts      Express application
└── backend/README.md     Backend-specific notes
```

## Requirements

- Node.js 20 or newer.
- npm.
- MongoDB.
- An EVM and/or Solana browser wallet for interactive sign-in.

## Environment variables

Create a root `.env.local` for the frontend and `backend/.env` for the backend. Never commit either file.

### Frontend

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

### Backend

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=avhisafe
CORS_ORIGIN=http://localhost:3000

# Optional provider configuration
SOLANA_RPC_URL=https://solana-rpc.publicnode.com
ETHEREUM_INDEXER_URL=https://api.ethplorer.io
ETHEREUM_INDEXER_API_KEY=freekey

# Optional AI configuration
AI_API_BASE=https://api.example.com/v1
AI_API_KEY=replace-me
AI_MODEL=replace-me
```

Use a managed RPC, indexer, price provider, and secret manager in production. Do not use public or demo provider credentials for a production deployment.

## Local development

Install dependencies in both workspaces:

```bash
npm install
cd backend && npm install
```

Create MongoDB indexes once for a new database:

```bash
cd backend
npm run db:indexes
```

Run the backend:

```bash
cd backend
npm run dev
```

Run the frontend in another terminal:

```bash
npm run dev
```

The frontend is normally available at `http://localhost:3000` and the backend at `http://localhost:4000`.

## Validation commands

Frontend production build:

```bash
npm run build
```

Backend type-check, tests, and build:

```bash
cd backend
npm run lint
npm test
npm run build
```

## API overview

Public endpoints:

- `GET /health`
- `GET /ready`
- `POST /api/v1/auth/nonce`
- `POST /api/v1/auth/verify`
- `GET /api/v1/ai/status`

Authenticated endpoints include:

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/sessions/:sessionId/revoke`
- `GET|POST /api/v1/wallets`
- `POST /api/v1/wallets/watch-only`
- `POST /api/v1/wallets/generated`
- `POST /api/v1/wallets/connected`
- `PATCH|DELETE /api/v1/wallets/:walletId`
- `GET|PUT /api/v1/vault`
- `POST /api/v1/portfolio`
- `GET /api/v1/portfolio/history`
- `GET /api/v1/security/alerts`
- `GET /api/v1/security/scans`
- `POST /api/v1/security/scan`
- `PATCH /api/v1/security/alerts/:alertId`
- `GET /api/v1/auth/export`
- `DELETE /api/v1/auth/account` with `{ "confirmation": "DELETE" }`
- Dashboard CRUD, revisions, UI revisions, undo, permissions, and AI plan/apply endpoints.

Portfolio requests are authorized against active wallet records owned by the signed-in account. Client-provided addresses are not sufficient authorization.

## Security model

- The backend verifies wallet signatures and invalidates single-use nonces.
- Session tokens are stored server-side as hashes and delivered in HttpOnly cookies.
- All user-owned resources are queried with the authenticated session user ID.
- Portfolio reads accept only active wallet records belonging to the current account.
- State-changing authenticated requests require an allowed origin when an `Origin` header is present.
- Authentication, AI, portfolio, and vault endpoints have bounded request rates.
- Server-side validation uses strict Zod schemas and bounded JSON request sizes.
- Security headers disable framing and reduce browser capability exposure.
- Encrypted vault ciphertext is synchronized; the vault password and plaintext wallet secrets remain client-side.
- Generated wallet signing is not enabled; AvhiSafe is read-only.

Portfolio snapshots are persisted when a user refreshes the portfolio and can be read through the authenticated history endpoint. Background refresh queues, provider failover, broad contract/approval intelligence, durable audit-event coverage, and full observability remain production-hardening work. The current baseline security scan deliberately reports only policy-boundary evidence and does not claim that a wallet or contract is safe.

## Contribution notes

Keep changes focused, add or update tests for security-sensitive behavior, and run all validation commands before opening a pull request. Never commit credentials, seed phrases, private keys, session tokens, or provider secrets.
