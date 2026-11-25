import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { MongoServerError } from "mongodb";
import { z } from "zod";
import { aiApplyInput } from "./aiApplySchema.js";
import { collections, createDashboardRevision, ensureDefaultDashboard, ensureUIDocument, findDashboardForUser, findUIDocumentForUser, findDefaultDashboard, listUserDashboards, listUserPermissions, listUserPublicAddresses, listUserRevisions, listUIRevisions, listUserWallets, pingDatabase } from "./db.js";
import { planDashboardUi } from "./aiUiPlanner.js";
import { sanitizeUiSpec } from "./uiSchema.js";
import { saveUiForUser, uiRevisionFor } from "./uiService.js";
import { applyOperations, revisionFor } from "./dashboardService.js";
import { allowedWidgetTypes, defaultWidgets } from "./widgetCatalog.js";
import type { DashboardDocument, DashboardRevisionDocument } from "./models/index.js";
import { authRoutes } from "./routes/authRoutes.js";
import { walletRoutes } from "./routes/walletRoutes.js";
import { portfolioRoutes } from "./routes/portfolioRoutes.js";
import { vaultRoutes } from "./routes/vaultRoutes.js";
import { modelRoutes } from "./routes/modelRoutes.js";
import { securityRoutes } from "./routes/securityRoutes.js";
import { authenticate } from "./middleware/authenticate.js";
import { authenticatedUserId, trustedOriginMiddleware } from "./middleware/requestSecurity.js";
import { rateLimit, securityHeaders } from "./middleware/security.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const configuredOrigins = (process.env.CORS_ORIGIN || "").split(",").map((value) => value.trim().replace(/\/$/, "")).filter(Boolean);
const allowedOrigins = new Set(["https://avhisafe.netlify.app", ...configuredOrigins]);
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors({ credentials: true, origin: (requestOrigin, callback) => { const normalizedOrigin = requestOrigin?.replace(/\/$/, ""); if (!normalizedOrigin || configuredOrigins.includes("*") || allowedOrigins.has(normalizedOrigin)) callback(null, true); else callback(new Error("CORS origin not allowed")); } }));
app.use(express.json({ limit: "512kb" }));

function errorResponse(response: Response, error: unknown, fallback: string, status = 400) { return response.status(status).json({ error: error instanceof Error ? error.message : fallback }); }
function requireRole(...roles: Array<"user" | "admin">) { return (request: Request, response: Response, next: NextFunction) => { if (!request.auth) return response.status(401).json({ error: "Authentication required." }); if (!roles.includes(request.auth.role)) return response.status(403).json({ error: "Insufficient role for this resource." }); return next(); }; }

const widgetSchema = z.object({ id: z.string().min(1).max(100), type: z.string().min(1).max(80).refine((type) => allowedWidgetTypes.has(type), "Unsupported widget type."), title: z.string().trim().max(160).optional(), enabled: z.boolean(), position: z.number().int().min(0).max(1000), width: z.enum(["small", "medium", "large", "full"]), config: z.record(z.string(), z.unknown()).default({}) });
const widgetsSchema = z.array(widgetSchema).max(20).superRefine((widgets, context) => { const ids = new Set<string>(); for (const [index, widget] of widgets.entries()) { if (ids.has(widget.id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Widget IDs must be unique." }); ids.add(widget.id); } });
const dashboardInput = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().trim().regex(/^[a-z0-9-]{1,80}$/), theme: z.enum(["light", "dark", "system"]), currency: z.string().trim().regex(/^[A-Z]{3,8}$/), density: z.enum(["comfortable", "compact", "analytics"]), isDefault: z.boolean().default(false), widgets: widgetsSchema, filters: z.record(z.string(), z.unknown()).default({}) });
const dashboardPatch = z.object({ name: dashboardInput.shape.name.optional(), slug: dashboardInput.shape.slug.optional(), theme: dashboardInput.shape.theme.optional(), currency: dashboardInput.shape.currency.optional(), density: dashboardInput.shape.density.optional(), isDefault: dashboardInput.shape.isDefault.optional(), widgets: widgetsSchema.optional(), filters: dashboardInput.shape.filters.optional(), revisionSummary: z.string().trim().min(1).max(500).optional(), expectedVersion: z.number().int().min(1).optional() }).strict();
const aiInput = z.object({ dashboardId: z.string().optional(), prompt: z.string().trim().min(3).max(8000) }).strict();
const permissionInput = z.object({ featureKey: z.string().trim().min(1).max(100), enabled: z.boolean(), config: z.record(z.string(), z.unknown()).default({}) }).strict();
const addressInput = z.object({ chain: z.enum(["ethereum", "solana"]), address: z.string().min(20).max(128), label: z.string().max(120).optional(), notes: z.string().max(1000).optional(), source: z.enum(["watch", "generated", "connected"]).default("watch") }).strict();
const walletInput = z.object({ chain: z.enum(["ethereum", "solana"]), address: z.string().min(20).max(128), provider: z.string().max(120), label: z.string().max(120).optional(), chainId: z.string().max(32).optional() }).strict();

app.get("/health", (_request, response) => response.json({ ok: true, service: "avhisafe-backend", database: "mongodb", timestamp: new Date().toISOString() }));
app.get("/ready", async (_request, response) => { try { await pingDatabase(); return response.json({ ok: true, database: "available" }); } catch (error) { return errorResponse(response, error, "MongoDB unavailable.", 503); } });

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/wallets", walletRoutes);
app.use("/api/v1/vault", vaultRoutes);
app.get("/api/v1/ai/status", (_request, response) => { const configured = Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY) && Boolean(process.env.AI_API_BASE || process.env.OPENAI_API_BASE); return response.json({ configured, mode: configured ? "ai" : "unconfigured", model: process.env.AI_MODEL || "gemini-3.6-flash" }); });

app.use("/api/v1", authenticate);
app.use("/api/v1", trustedOriginMiddleware(allowedOrigins));
app.use("/api/v1/ai", rateLimit({ windowMs: 60_000, max: 12, message: "Too many AI dashboard requests. Please try again shortly." }));
app.use("/api/v1/portfolio", portfolioRoutes);
app.use("/api/v1", modelRoutes);
app.use("/api/v1/security", securityRoutes);
app.get("/api/v1/admin/dashboard-analytics", requireRole("admin"), async (_request, response) => { try { const [users, dashboards, wallets] = await Promise.all([collections.users(), collections.dashboards(), collections.wallets()]); return response.json({ role: "admin", totals: { users: await users.countDocuments({ status: "active" }), dashboards: await dashboards.countDocuments(), wallets: await wallets.countDocuments({ status: { $ne: "removed" } }) } }); } catch (error) { return errorResponse(response, error, "Unable to load admin analytics.", 500); } });

app.get("/api/v1/dashboards", async (request, response) => { try { return response.json({ dashboards: await listUserDashboards(authenticatedUserId(request)) }); } catch (error) { return errorResponse(response, error, "Unable to list dashboards.", 401); } });
app.post("/api/v1/dashboards", async (request, response) => {
  try {
    const userId = authenticatedUserId(request);
    const input = dashboardInput.parse(request.body);
    const now = new Date();
    const dashboard: DashboardDocument = { _id: randomUUID(), userId, ...input, widgets: input.widgets.length ? input.widgets : defaultWidgets(), version: 1, createdAt: now, updatedAt: now };
    const dashboards = await collections.dashboards();
    if (dashboard.isDefault) await dashboards.updateMany({ userId }, { $set: { isDefault: false, updatedAt: now } });
    await dashboards.insertOne(dashboard);
    await revisionFor(dashboard, userId, "system", "Created dashboard", undefined, now);
    const uiDocument = await ensureUIDocument(userId, dashboard._id);
    return response.status(201).json({ dashboard, uiDocument });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return response.status(409).json({ error: "A dashboard with that slug already exists for this account.", code: "DASHBOARD_SLUG_CONFLICT" });
    }
    return errorResponse(response, error, "Invalid dashboard.");
  }
});

app.get("/api/v1/workspace", async (request, response) => { try { const userId = authenticatedUserId(request); const dashboard = await ensureDefaultDashboard(userId); const uiDocument = await ensureUIDocument(userId, dashboard._id); const [dashboards, revisions, uiRevisions, addresses, wallets, permissions] = await Promise.all([listUserDashboards(userId), listUserRevisions(userId, dashboard._id), listUIRevisions(userId, dashboard._id), listUserPublicAddresses(userId), listUserWallets(userId), listUserPermissions(userId)]); return response.json({ dashboard, uiDocument, dashboards, revisions, uiRevisions, addresses, wallets, permissions }); } catch (error) { return errorResponse(response, error, "Unable to load workspace.", 401); } });

app.get("/api/v1/dashboards/:dashboardId", async (request, response) => { try { const userId = authenticatedUserId(request); const dashboard = await findDashboardForUser(userId, request.params.dashboardId); return dashboard ? response.json({ dashboard, uiDocument: await ensureUIDocument(userId, dashboard._id) }) : response.status(404).json({ error: "Dashboard not found." }); } catch (error) { return errorResponse(response, error, "Unable to load dashboard.", 401); } });
app.patch("/api/v1/dashboards/:dashboardId", async (request, response) => { try { const userId = authenticatedUserId(request); const patch = dashboardPatch.parse(request.body); const current = await findDashboardForUser(userId, request.params.dashboardId); if (!current) return response.status(404).json({ error: "Dashboard not found." }); const { revisionSummary, expectedVersion, ...changes } = patch; const currentVersion = current.version ?? 1; if (expectedVersion !== undefined && expectedVersion !== currentVersion) return response.status(409).json({ error: "Dashboard changed in another session. Reload before saving.", code: "DASHBOARD_VERSION_CONFLICT", currentVersion }); const now = new Date(); const next = { ...current, ...changes, version: currentVersion + 1, updatedAt: now } as DashboardDocument; const dashboards = await collections.dashboards(); if (next.isDefault) await dashboards.updateMany({ userId, _id: { $ne: current._id } }, { $set: { isDefault: false, updatedAt: now } }); const write = await dashboards.replaceOne({ _id: current._id, userId, $or: [{ version: currentVersion }, { version: { $exists: false } }] }, next); if (write.matchedCount !== 1) return response.status(409).json({ error: "Dashboard changed in another session. Reload before saving.", code: "DASHBOARD_VERSION_CONFLICT", currentVersion }); const revision = await revisionFor(next, userId, "manual", revisionSummary || "Updated dashboard settings", undefined, now); return response.json({ dashboard: next, revision }); } catch (error) { return errorResponse(response, error, "Invalid dashboard update."); } });
app.delete("/api/v1/dashboards/:dashboardId", async (request, response) => { try { const userId = authenticatedUserId(request); const dashboard = await findDashboardForUser(userId, request.params.dashboardId); if (!dashboard) return response.status(404).json({ error: "Dashboard not found." }); if (dashboard.isDefault) return response.status(409).json({ error: "The default dashboard cannot be deleted." }); await (await collections.dashboards()).deleteOne({ _id: dashboard._id, userId }); return response.status(204).send(); } catch (error) { return errorResponse(response, error, "Unable to delete dashboard.", 401); } });
app.get("/api/v1/dashboards/:dashboardId/revisions", async (request, response) => { try { const userId = authenticatedUserId(request); if (!(await findDashboardForUser(userId, request.params.dashboardId))) return response.status(404).json({ error: "Dashboard not found." }); return response.json({ revisions: await listUserRevisions(userId, request.params.dashboardId) }); } catch (error) { return errorResponse(response, error, "Unable to load revisions.", 401); } });
app.post("/api/v1/dashboards/:dashboardId/undo", async (request, response) => { try { const userId = authenticatedUserId(request); const dashboard = await findDashboardForUser(userId, request.params.dashboardId); if (!dashboard) return response.status(404).json({ error: "Dashboard not found." }); const revisions = await listUserRevisions(userId, dashboard._id); const previous = revisions[1]; if (!previous) return response.status(409).json({ error: "No previous revision is available." }); const next = { ...dashboard, ...previous.snapshot, version: (dashboard.version ?? 1) + 1, updatedAt: new Date() } as DashboardDocument; const write = await (await collections.dashboards()).replaceOne({ _id: dashboard._id, userId, $or: [{ version: dashboard.version ?? 1 }, { version: { $exists: false } }] }, next); if (write.matchedCount !== 1) return response.status(409).json({ error: "Dashboard changed in another session. Reload before saving.", code: "DASHBOARD_VERSION_CONFLICT" }); const revision = await revisionFor(next, userId, "system", "Restored previous dashboard revision"); return response.json({ dashboard: next, revision }); } catch (error) { return errorResponse(response, error, "Unable to undo dashboard change.", 401); } });

app.post("/api/v1/ai/plan", async (request, response) => {
  try {
    const userId = authenticatedUserId(request);
    const input = aiInput.parse(request.body);
    const dashboard = input.dashboardId ? await findDashboardForUser(userId, input.dashboardId) : await ensureDefaultDashboard(userId);
    if (!dashboard) return response.status(404).json({ error: "Dashboard not found." });
    const currentUi = await ensureUIDocument(userId, dashboard._id);
    const plan = await planDashboardUi(input.prompt, dashboard, currentUi.spec);
    const now = new Date();
    const requestId = randomUUID();
    const requestDocument = { _id: requestId, userId, dashboardId: dashboard._id, prompt: input.prompt, intent: plan.intent, status: "planned" as const, response: plan as unknown as Record<string, unknown>, createdAt: now };
    const model = plan.model || process.env.AI_MODEL || "unknown";
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);
    await Promise.all([
      (await collections.aiRequests()).insertOne(requestDocument),
      (await collections.aiEdits()).insertOne({
        _id: requestId, userId, dashboardId: dashboard._id, prompt: input.prompt, model,
        provider: "configured-provider",
        inputVersion: currentUi.version, outputSummary: plan.explanation,
        operations: [
          ...plan.operations.map((operation) => ({ kind: "dashboard", ...operation })),
          ...(plan.ui?.components.map((component) => ({ kind: "ui_component", ...component })) || []),
        ],
        status: plan.intent === "unsupported" ? "rejected" : "planned",
        warnings: plan.warnings, requiresConfirmation: plan.requiresApproval, createdAt: now,
      }),
      (await collections.aiUsage()).updateOne(
        { userId, periodStart, model },
        { $inc: { requestCount: 1, ...(plan.intent === "customize_ui" && plan.requiresApproval ? { successfulRequestCount: 1 } : { failedRequestCount: 1 }) }, $set: { periodEnd, updatedAt: now }, $setOnInsert: { _id: `${userId}:${periodStart.toISOString()}:${model}`, userId, periodStart, model, currency: "USD" } },
        { upsert: true },
      ),
    ]);
    return response.status(201).json({ request: requestDocument, plan: { ...plan, requestId } });
  } catch (error) {
    return errorResponse(response, error, "Unable to create AI UI plan.", error instanceof Error && error.message.includes("Authentication") ? 401 : 400);
  }
});
app.post("/api/v1/ai/apply", async (request, response) => {
  try {
    const userId = authenticatedUserId(request);
    const input = aiApplyInput.parse(request.body);
    const dashboard = await findDashboardForUser(userId, input.dashboardId);
    if (!dashboard) return response.status(404).json({ error: "Dashboard not found." });
    if (input.plan.intent !== "customize_ui") return response.status(422).json({ error: "This AI request did not produce an applicable UI change." });
    if (!input.plan.requiresApproval) return response.status(422).json({ error: "This AI plan is not marked for approval." });
    const currentVersion = dashboard.version ?? 1;
    if (input.plan.expectedVersion !== currentVersion) return response.status(409).json({ error: "Dashboard changed after this plan was generated. Generate a fresh plan before applying.", code: "DASHBOARD_VERSION_CONFLICT", currentVersion });
    const spec = sanitizeUiSpec(input.plan.ui);
    const applied = applyOperations(dashboard, input.plan.operations);
    const updatedDashboard: DashboardDocument = { ...applied, version: currentVersion + 1, updatedAt: new Date() };
    const write = await (await collections.dashboards()).replaceOne(
      { _id: dashboard._id, userId, $or: [{ version: currentVersion }, { version: { $exists: false } }] },
      updatedDashboard,
    );
    if (write.matchedCount !== 1) return response.status(409).json({ error: "Dashboard changed in another session. Reload and generate a fresh plan.", code: "DASHBOARD_VERSION_CONFLICT", currentVersion });
    await revisionFor(updatedDashboard, userId, "ai", input.plan.explanation, input.prompt, updatedDashboard.updatedAt);
    const document = await saveUiForUser(userId, dashboard._id, spec, "ai", input.prompt);
    const revision = await uiRevisionFor(document, userId, "ai", input.plan.explanation, input.prompt);
    const completedAt = new Date();
    await Promise.all([
      (await collections.aiRequests()).updateOne(
        { userId, dashboardId: dashboard._id, prompt: input.prompt, status: "planned" },
        { $set: { status: "applied", response: { ...input.plan, ui: spec } as unknown as Record<string, unknown>, completedAt } },
      ),
      (await collections.aiEdits()).updateOne(
        input.plan.requestId
          ? { _id: input.plan.requestId, userId, dashboardId: dashboard._id }
          : { userId, dashboardId: dashboard._id, prompt: input.prompt, status: "planned" },
        { $set: { status: "applied", appliedVersion: document.version, completedAt } },
      ),
    ]);
    return response.json({ dashboard: updatedDashboard, uiDocument: document, revision, plan: { ...input.plan, ui: spec } });
  } catch (error) {
    return errorResponse(response, error, "Unable to apply AI UI plan.", error instanceof Error && error.message.includes("Authentication") ? 401 : 400);
  }
});
app.get("/api/v1/dashboards/:dashboardId/ui-revisions", async (request, response) => { try { const userId = authenticatedUserId(request); if (!(await findDashboardForUser(userId, request.params.dashboardId))) return response.status(404).json({ error: "Dashboard not found." }); return response.json({ revisions: await listUIRevisions(userId, request.params.dashboardId) }); } catch (error) { return errorResponse(response, error, "Unable to load UI revisions.", 401); } });
app.post("/api/v1/dashboards/:dashboardId/ui-undo", async (request, response) => { try { const userId = authenticatedUserId(request); const dashboard = await findDashboardForUser(userId, request.params.dashboardId); if (!dashboard) return response.status(404).json({ error: "Dashboard not found." }); const revisions = await listUIRevisions(userId, dashboard._id); const previous = revisions[1]; if (!previous) return response.status(409).json({ error: "No previous UI revision is available." }); const document = await saveUiForUser(userId, dashboard._id, previous.spec, "system", "Undo AI UI change"); const revision = await uiRevisionFor(document, userId, "system", "Restored previous AI UI revision"); return response.json({ dashboard, uiDocument: document, revision }); } catch (error) { return errorResponse(response, error, "Unable to undo AI UI change.", 401); } });

app.get("/api/v1/permissions", async (request, response) => { try { return response.json({ permissions: await listUserPermissions(authenticatedUserId(request)) }); } catch (error) { return errorResponse(response, error, "Unable to list permissions.", 401); } });
app.put("/api/v1/permissions/:featureKey", async (request, response) => { try { const userId = authenticatedUserId(request); const input = permissionInput.parse({ ...request.body, featureKey: request.params.featureKey }); const now = new Date(); const permission = { _id: `${userId}:${input.featureKey}`, userId, ...input, updatedAt: now }; await (await collections.permissions()).replaceOne({ userId, featureKey: input.featureKey }, permission, { upsert: true }); return response.json({ permission }); } catch (error) { return errorResponse(response, error, "Invalid permission."); } });

app.get("/api/v1/addresses", async (request, response) => { try { return response.json({ addresses: await listUserPublicAddresses(authenticatedUserId(request)) }); } catch (error) { return errorResponse(response, error, "Unable to list addresses.", 401); } });
app.post("/api/v1/addresses", async (request, response) => { try { const userId = authenticatedUserId(request); const input = addressInput.parse(request.body); const now = new Date(); const address = { _id: randomUUID(), userId, ...input, createdAt: now, updatedAt: now }; await (await collections.addresses()).replaceOne({ userId, chain: input.chain, address: input.address }, address, { upsert: true }); return response.status(201).json({ address }); } catch (error) { return errorResponse(response, error, "Invalid address."); } });
app.delete("/api/v1/addresses/:addressId", async (request, response) => { try { await (await collections.addresses()).deleteOne({ _id: request.params.addressId, userId: authenticatedUserId(request) }); return response.status(204).send(); } catch (error) { return errorResponse(response, error, "Unable to delete address.", 401); } });

app.use((error: unknown, _request: Request, response: Response, _next: unknown) => response.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error." }));
app.listen(port, () => console.log(`AvhiSafe MongoDB backend listening on http://localhost:${port}`));
