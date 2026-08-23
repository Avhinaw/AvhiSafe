import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { collections, createDashboardRevision, findDashboardForUser, findDefaultDashboard, listUserDashboards, listUserPermissions, listUserPublicAddresses, listUserRevisions, listUserWallets, pingDatabase } from "./db.js";
import type { DashboardDocument, DashboardRevisionDocument } from "./models.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const origin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({ origin }));
app.use(express.json({ limit: "512kb" }));

function userIdFromRequest(request: Request) {
  const userId = request.header("x-user-id");
  if (!userId || !/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) throw new Error("Missing or invalid x-user-id.");
  return userId;
}

const widgetSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.string().min(1).max(80),
  title: z.string().max(160).optional(),
  enabled: z.boolean(),
  position: z.number().int().min(0).max(1000),
  width: z.enum(["small", "medium", "large", "full"]),
  config: z.record(z.string(), z.unknown()).default({}),
});

const dashboardInput = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]{1,80}$/),
  theme: z.enum(["light", "dark", "system"]),
  currency: z.string().trim().regex(/^[A-Z]{3,8}$/),
  density: z.enum(["comfortable", "compact", "analytics"]),
  isDefault: z.boolean().default(false),
  widgets: z.array(widgetSchema).max(100),
  filters: z.record(z.string(), z.unknown()).default({}),
});

const dashboardPatch = dashboardInput.partial().extend({ revisionSummary: z.string().trim().min(1).max(500).optional() }).strict();

app.get("/health", (_request, response) => response.json({ ok: true, service: "avhisafe-backend", database: "mongodb", timestamp: new Date().toISOString() }));

app.get("/ready", async (_request, response) => {
  try { await pingDatabase(); return response.json({ ok: true, database: "available" }); }
  catch (error) { return response.status(503).json({ ok: false, database: "unavailable", message: error instanceof Error ? error.message : "MongoDB unavailable." }); }
});

app.get("/api/v1/dashboards", async (request, response) => {
  try { return response.json({ dashboards: await listUserDashboards(userIdFromRequest(request)) }); }
  catch (error) { return response.status(401).json({ error: error instanceof Error ? error.message : "Unable to list dashboards." }); }
});

app.post("/api/v1/dashboards", async (request, response) => {
  try {
    const userId = userIdFromRequest(request);
    const input = dashboardInput.parse(request.body);
    const now = new Date();
    const dashboard: DashboardDocument = { _id: randomUUID(), userId, ...input, createdAt: now, updatedAt: now };
    const dashboards = await collections.dashboards();
    if (dashboard.isDefault) await dashboards.updateMany({ userId }, { $set: { isDefault: false, updatedAt: now } });
    await dashboards.insertOne(dashboard);
    return response.status(201).json({ dashboard });
  } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid dashboard." }); }
});

app.get("/api/v1/workspace", async (request, response) => {
  try {
    const userId = userIdFromRequest(request);
    const dashboard = await findDefaultDashboard(userId);
    if (!dashboard) return response.status(404).json({ error: "Default dashboard not found." });
    const [dashboards, revisions, addresses, wallets, permissions] = await Promise.all([
      listUserDashboards(userId), listUserRevisions(userId, dashboard._id), listUserPublicAddresses(userId), listUserWallets(userId), listUserPermissions(userId),
    ]);
    return response.json({ dashboard, dashboards, revisions, addresses, wallets, permissions });
  } catch (error) { const message = error instanceof Error ? error.message : "Unable to load workspace."; return response.status(message.includes("x-user-id") ? 401 : 500).json({ error: message }); }
});

app.patch("/api/v1/dashboards/:dashboardId", async (request, response) => {
  try {
    const userId = userIdFromRequest(request);
    const patch = dashboardPatch.parse(request.body);
    const current = await findDashboardForUser(userId, request.params.dashboardId);
    if (!current) return response.status(404).json({ error: "Dashboard not found." });
    const { revisionSummary, ...changes } = patch;
    const now = new Date();
    const next = { ...current, ...changes, updatedAt: now } as DashboardDocument;
    const dashboards = await collections.dashboards();
    if (next.isDefault) await dashboards.updateMany({ userId, _id: { $ne: current._id } }, { $set: { isDefault: false, updatedAt: now } });
    await dashboards.replaceOne({ _id: current._id, userId }, next);
    const revision: DashboardRevisionDocument = { _id: randomUUID(), userId, dashboardId: current._id, source: "manual", summary: revisionSummary || "Updated dashboard settings", snapshot: { name: next.name, theme: next.theme, currency: next.currency, density: next.density, widgets: next.widgets, filters: next.filters }, createdAt: now };
    await createDashboardRevision(revision);
    return response.json({ dashboard: next, revision });
  } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid dashboard update." }); }
});

app.get("/api/v1/dashboards/:dashboardId/revisions", async (request, response) => {
  try { const userId = userIdFromRequest(request); if (!(await findDashboardForUser(userId, request.params.dashboardId))) return response.status(404).json({ error: "Dashboard not found." }); return response.json({ revisions: await listUserRevisions(userId, request.params.dashboardId) }); }
  catch (error) { return response.status(401).json({ error: error instanceof Error ? error.message : "Unable to load revisions." }); }
});

const aiPlanInput = z.object({ dashboardId: z.string().optional(), prompt: z.string().trim().min(3).max(8000) }).strict();
app.post("/api/v1/ai/requests", async (request, response) => {
  try {
    const userId = userIdFromRequest(request);
    const input = aiPlanInput.parse(request.body);
    if (input.dashboardId && !(await findDashboardForUser(userId, input.dashboardId))) return response.status(404).json({ error: "Dashboard not found." });
    const requestDocument = { _id: randomUUID(), userId, dashboardId: input.dashboardId, prompt: input.prompt, status: "planned" as const, createdAt: new Date() };
    await (await collections.aiRequests()).insertOne(requestDocument);
    return response.status(201).json({ request: requestDocument, next: "Connect the server-side AI planner and return schema-validated widget operations." });
  } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid AI request." }); }
});

app.use((error: unknown, _request: Request, response: Response, _next: unknown) => response.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error." }));
app.listen(port, () => console.log(`AvhiSafe MongoDB backend listening on http://localhost:${port}`));
