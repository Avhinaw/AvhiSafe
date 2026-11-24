# AvhiSafe MongoDB Backend

This folder contains the standalone backend service for AvhiSafe’s per-user AI dashboard system. The frontend remains in the repository root, while this service owns authenticated dashboard configuration, widget layouts, AI request history, revisions, permissions, connected wallet metadata, and public portfolio metadata.

## MongoDB setup

Copy `.env.example` to `.env` and configure a MongoDB connection:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=avhisafe

# Wallet-signature authentication
AUTH_DOMAIN=avhisafe.netlify.app
AUTH_URI=https://avhisafe.netlify.app
# Set COOKIE_SECURE=false only for local HTTP development.
COOKIE_SECURE=true
# Use None for the deployed Netlify-to-Render cross-site API; defaults to None when secure.
COOKIE_SAME_SITE=None
```

MongoDB Atlas connection strings are also supported. Do not commit `.env` files.

For the Google AI Studio OpenAI-compatible endpoint, configure the model on the server only:

```env
AI_API_BASE=https://generativelanguage.googleapis.com/v1beta/openai/
AI_MODEL=gemini-3.6-flash
AI_API_KEY=your_fresh_provider_key
```

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
| `auth_nonces` | Short-lived, single-use wallet sign-in challenges |
| `sessions` | Hashed browser sessions with expiry and revocation state |
| `dashboards` | Personal dashboard name, theme, currency, filters, and widget layout |
| `dashboard_revisions` | Manual and AI-generated dashboard snapshots for undo/history |
| `ai_requests` | User prompts, AI plan status, and structured responses |
| `feature_permissions` | Per-user feature enablement and configuration |
| `wallets` | Authenticated connected and watch-only wallet records |
| `connected_wallets` | Public MetaMask/EVM and Solana wallet metadata |
| `public_addresses` | Watch-only and generated public addresses |
| `portfolio_snapshots` | Historical read-only portfolio values |
| `assets`, `asset_prices`, `token_balances` | Normalized public asset metadata, price observations, and per-wallet balances |
| `transactions` | Read-only transaction records indexed by wallet and network |
| `wallet_syncs`, `transaction_syncs` | Provider refresh status and fetched-record counts |
| `blockchain_networks`, `widget_definitions` | Enabled network and renderer catalogs |
| `dashboard_preferences`, `dashboard_templates` | Per-dashboard refresh/display settings and reusable layouts |
| `security_scans`, `security_checks`, `security_alerts` | Wallet-record validation runs and their user-owned results |
| `notifications` | Per-user security and workspace inbox |
| `ai_edit_history`, `ai_usage` | AI plan lifecycle and daily request counts (provider token/cost data is not fabricated) |
| `integrations` | Read-only adapter metadata; no credentials or external adapters are accepted |
| `audit_logs` | User actions on model-backed workspace features |
| `ai_ui_documents` | Complete validated AI-generated UI document per user and dashboard |
| `ai_ui_revisions` | Versioned AI UI documents for per-user undo/history |

## Current API

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness check; does not require MongoDB |
| `GET /ready` | MongoDB readiness check |
| `GET /api/v1/dashboards` | List the authenticated user’s dashboards |
| `POST /api/v1/dashboards` | Create a user-owned dashboard |
| `GET /api/v1/workspace` | Load the default dashboard and related user-owned metadata |
| `PATCH /api/v1/dashboards/:dashboardId` | Update a dashboard and create a revision |
| `GET /api/v1/dashboards/:dashboardId/revisions` | Read that dashboard’s data revision history |
| `GET /api/v1/dashboards/:dashboardId/ui-revisions` | Read that dashboard’s generated UI revision history |
| `POST /api/v1/dashboards/:dashboardId/ui-undo` | Restore the previous generated UI for that user and dashboard |
| `GET /api/v1/ai/status` | Report whether the server-side AI provider is configured without exposing credentials |
| `POST /api/v1/ai/plan` | Send a natural-language request to the server-side model and return a complete validated UI document preview |
| `POST /api/v1/ai/apply` | Persist an approved generated UI document for only that user and dashboard |
| `GET /api/v1/catalog` | Load persisted widget definitions, enabled networks, and system/account dashboard templates |
| `GET, PUT /api/v1/dashboards/:dashboardId/preferences` | Read and update preferences for an owned dashboard |
| `POST /api/v1/dashboard-templates` | Save an owned dashboard layout as a reusable template |
| `POST /api/v1/dashboard-templates/:templateId/apply` | Apply an owned or published system template, preserving the UI document |
| `GET /api/v1/activity` | Read the current user’s stored balances, snapshots, transactions, and sync records |
| `GET, POST /api/v1/security/scans` | Read results or run supported baseline wallet-record checks |
| `PATCH /api/v1/security/alerts/:alertId` | Acknowledge, resolve, or dismiss an owned security alert |
| `GET /api/v1/notifications` | Read the authenticated user’s notification inbox |
| `PATCH /api/v1/notifications/:notificationId` | Mark an owned notification read or archived |
| `GET /api/v1/ai/usage` | Read per-user AI request counts and edit history |
| `GET /api/v1/profile/preferences` | Read account display and notification preferences |
| `PUT /api/v1/profile/preferences` | Update account display and notification preferences |
| `GET /api/v1/sessions` | List safe session metadata without token or fingerprint hashes |
| `GET /api/v1/audit-logs` | Read recent workspace model actions for the authenticated user |
| `GET /api/v1/integrations` | List safe integration metadata and report available adapters |

## Authentication and wallet routes

Authentication uses a short-lived, single-use wallet signature challenge. The server stores only the nonce metadata, verified public wallet identity, and a hash of the session token; it never receives or stores a private key or seed phrase.

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/auth/nonce` | Issue an EVM or Solana sign-in challenge |
| `POST /api/v1/auth/verify` | Verify the signature and create an HttpOnly session cookie |
| `GET /api/v1/auth/me` | Return the authenticated user and session metadata |
| `POST /api/v1/auth/logout` | Revoke the current session and clear the cookie |
| `POST /api/v1/auth/sessions/:sessionId/revoke` | Revoke one session owned by the current user |
| `GET /api/v1/wallets` | List wallets owned by the authenticated user |
| `POST /api/v1/wallets/watch-only` | Add a validated public address without wallet-provider access |
| `POST /api/v1/wallets/connected` | Save a connected-wallet public address and provider metadata |
| `PATCH /api/v1/wallets/:walletId` | Rename, hide, archive, disconnect, or update networks |
| `DELETE /api/v1/wallets/:walletId` | Soft-remove a wallet from the account |

For local development, use `AUTH_DOMAIN=localhost:3000`, `AUTH_URI=http://localhost:3000`, and `COOKIE_SECURE=false` (which defaults `COOKIE_SAME_SITE` to `Lax`). The deployed Netlify-to-Render setup requires HTTPS, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=None`, and credentialed browser requests so the HttpOnly session cookie is included.

All user-owned dashboard, AI, address, permission, and wallet routes use the `authenticate` middleware and derive the user ID exclusively from the verified HttpOnly session. The frontend does not send a client-supplied user ID. State-changing API requests with an `Origin` header are restricted to the configured CORS allowlist, authentication challenge/verification endpoints are rate-limited, and baseline security headers are applied globally.

Portfolio provider responses are persisted only for wallets already owned by the authenticated account. Failed or unavailable provider responses update sync status but do not overwrite the last stored balances with zero values. Security baseline checks validate wallet-record address and network metadata only; they do not scan transactions, approvals, contracts, phishing, or on-chain risk. The integration catalog is intentionally read-only until real provider adapters and secure credential handling are implemented.

The AI UI endpoint sends the prompt to a server-side model. The model returns a complete declarative UI document; the backend validates it with a strict Zod schema, previews it, and persists it only after explicit user approval. There is no keyword planner or client-side AI fallback. If the provider is unavailable, the UI reports the failure instead of pretending that an AI change happened. For the current Google provider configuration, set `AI_MODEL=gemini-3.6-flash`; older `gemini-2.5-flash` configurations are unavailable to new users.

Generated UI is intentionally a safe declarative component document rather than executable JSX or JavaScript. The trusted renderer supports registered wallet/portfolio widgets, text, metrics, cards, status badges, short safety lists, dividers, bounded layouts, complete theme presets, typography presets, density presets, and bounded accent presets. A prompt can therefore request a complete dark or light theme, glass/soft/flat surfaces, compact or comfortable spacing, rounded or sharp cards, technical or editorial typography, widget additions/removals, data-view ordering, risk panels, review checklists, status callouts, and other small compositions built from registered primitives. Arbitrary model-generated code is never executed in the wallet application. Requests for transactions, signing, private-key access, backend queries, arbitrary plugins, or new executable functionality are rejected or returned as unsupported.

AvhiSafe never sends private keys or recovery phrases to this backend or to the AI. MongoDB stores account settings, dashboard configuration, and public-address portfolio/security metadata; encrypted vault bytes remain client-encrypted and are never decrypted by the backend.
