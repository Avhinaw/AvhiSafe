import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { collections, ensureUIDocument, findDashboardForUser } from "../db.js";
import { revisionFor } from "../dashboardService.js";
import { saveUiForUser, uiRevisionFor } from "../uiService.js";
import { normalizeWalletAddress } from "../walletValidation.js";
import { widgetCatalog, type WidgetType } from "../widgetCatalog.js";
import { defaultUiSpec, sanitizeUiSpec } from "../uiSchema.js";
import type {
  AuditLogDocument, DashboardPreferenceDocument, DashboardTemplateDocument, SecurityAlertDocument,
  SecurityCheckDocument, SecurityScanDocument, WidgetDefinitionDocument,
} from "../models/index.js";

export const modelRoutes = Router();

function userId(request: Request, response: Response) {
  if (!request.auth) {
    response.status(401).json({ error: "Authentication required." });
    return undefined;
  }
  return request.auth.userId;
}

function errorResponse(response: Response, error: unknown, fallback: string) {
  return response.status(400).json({ error: error instanceof Error ? error.message : fallback });
}

async function writeAudit(userId: string, action: string, resourceType: string, resourceId?: string) {
  const entry: AuditLogDocument = {
    _id: randomUUID(), userId, actorType: "user", actorId: userId, action,
    resourceType, resourceId, result: "success", createdAt: new Date(),
  };
  await (await collections.auditLogs()).insertOne(entry);
}

const userPreferencesInput = z.object({
  currency: z.string().trim().regex(/^[A-Z]{3,8}$/).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  notifications: z.record(z.string(), z.boolean()).optional(),
}).strict();

modelRoutes.get("/profile/preferences", async (request, response) => {
  const id = userId(request, response);
  if (!id) return;
  const user = await (await collections.users()).findOne({ _id: id }, { projection: { preferences: 1 } });
  return user ? response.json({ preferences: user.preferences }) : response.status(404).json({ error: "User not found." });
});

modelRoutes.put("/profile/preferences", async (request, response) => {
  try {
    const id = userId(request, response);
    if (!id) return;
    const input = userPreferencesInput.parse(request.body);
    const preferenceUpdates = Object.fromEntries(Object.entries(input).map(([key, value]) => [`preferences.${key}`, value]));
    const result = await (await collections.users()).findOneAndUpdate(
      { _id: id, status: "active" },
      { $set: { ...preferenceUpdates, updatedAt: new Date() } },
      { returnDocument: "after", projection: { preferences: 1 } },
    );
    if (!result) return response.status(404).json({ error: "User not found." });
    await writeAudit(id, "update_preferences", "user", id);
    return response.json({ preferences: result.preferences });
  } catch (error) {
    return errorResponse(response, error, "Unable to update profile preferences.");
  }
});

modelRoutes.get("/sessions", async (request, response) => {
  const id = userId(request, response);
  if (!id) return;
  const sessions = await (await collections.sessions())
    .find({ userId: id })
    .project({ tokenHash: 0, ipHash: 0, userAgentHash: 0 })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray();
  return response.json({ sessions: sessions.map((session) => ({ ...session, isCurrent: session._id === request.auth?.sessionId })) });
});

modelRoutes.get("/audit-logs", async (request, response) => {
  const id = userId(request, response);
  if (!id) return;
  const logs = await (await collections.auditLogs()).find({ userId: id }).sort({ createdAt: -1 }).limit(50).toArray();
  return response.json({ logs });
});

const systemTemplates: Array<Pick<DashboardTemplateDocument, "_id" | "name" | "description" | "category" | "schemaVersion" | "theme" | "widgets" | "isSystem" | "isPublished">> = [
  {
    _id: "template-portfolio",
    name: "Portfolio overview",
    description: "A balanced overview of portfolio value, holdings, and history.",
    category: "portfolio",
    schemaVersion: 1,
    theme: "system",
    isSystem: true,
    isPublished: true,
    widgets: ["portfolio-value", "balances", "token-holdings", "portfolio-history"].map((type, position) => {
      const definition = widgetCatalog.find((item) => item.type === type)!;
      return { id: `${type}-template`, type, title: definition.label, enabled: true, position, width: definition.defaultWidth, config: {} };
    }),
  },
  {
    _id: "template-security",
    name: "Security workspace",
    description: "A focused layout for wallet connections and security review.",
    category: "security",
    schemaVersion: 1,
    theme: "system",
    isSystem: true,
    isPublished: true,
    widgets: ["security-score", "connected-wallets", "risk-summary", "transactions"].map((type, position) => {
      const definition = widgetCatalog.find((item) => item.type === type)!;
      return { id: `${type}-template`, type, title: definition.label, enabled: true, position, width: definition.defaultWidth, config: {} };
    }),
  },
  {
    _id: "template-activity",
    name: "Activity tracker",
    description: "Recent transactions and balances across supported wallets.",
    category: "research",
    schemaVersion: 1,
    theme: "system",
    isSystem: true,
    isPublished: true,
    widgets: ["transactions", "balances", "portfolio-history", "connected-wallets"].map((type, position) => {
      const definition = widgetCatalog.find((item) => item.type === type)!;
      return { id: `${type}-template`, type, title: definition.label, enabled: true, position, width: definition.defaultWidth, config: {} };
    }),
  },
];

async function seedCatalog() {
  const now = new Date();
  const templateCollection = await collections.dashboardTemplates();
  await templateCollection.bulkWrite(systemTemplates.map((template) => ({
    updateOne: {
      filter: { _id: template._id, isSystem: true },
      update: { $setOnInsert: { ...template, createdAt: now, updatedAt: now } },
      upsert: true,
    },
  })));

  const widgetCollection = await collections.widgetDefinitions();
  const categoryFor = (type: string): WidgetDefinitionDocument["category"] => {
    if (type.includes("security") || type.includes("risk")) return "security";
    if (type.includes("wallet")) return "wallet";
    if (type.includes("transaction")) return "transactions";
    if (type.includes("history") || type.includes("portfolio") || type.includes("balances") || type.includes("holdings")) return "portfolio";
    if (type.includes("nft")) return "nft";
    if (type.includes("defi")) return "defi";
    return "network";
  };
  await widgetCollection.bulkWrite(widgetCatalog.map((widget) => ({
    updateOne: {
      filter: { _id: `widget:${widget.type}:1` },
      update: {
        $setOnInsert: {
          _id: `widget:${widget.type}:1`, type: widget.type, version: 1, name: widget.label,
          description: widget.description, category: categoryFor(widget.type), lifecycle: "active",
          settingsSchema: {}, dataContract: {}, permissions: [], rendererKey: widget.type, createdAt: now, updatedAt: now,
        } satisfies WidgetDefinitionDocument,
      },
      upsert: true,
    },
  })));

  const networkCollection = await collections.networks();
  const networks = [
    { _id: "network:ethereum-mainnet", key: "ethereum-mainnet", chainFamily: "ethereum" as const, chainId: "1", name: "Ethereum", shortName: "ETH", environment: "mainnet" as const, enabled: true, capabilities: ["balances", "tokens", "transactions"] },
    { _id: "network:solana-mainnet", key: "solana-mainnet", chainFamily: "solana" as const, chainId: "mainnet-beta", name: "Solana", shortName: "SOL", environment: "mainnet" as const, enabled: true, capabilities: ["balances", "tokens", "transactions"] },
  ];
  await networkCollection.bulkWrite(networks.map((network) => ({
    updateOne: {
      filter: { key: network.key },
      update: { $setOnInsert: { ...network, createdAt: now, updatedAt: now } },
      upsert: true,
    },
  })));
}

modelRoutes.get("/catalog", async (request, response) => {
  if (!userId(request, response)) return;
  try {
    await seedCatalog();
    const [widgets, networks, templates] = await Promise.all([
      (await collections.widgetDefinitions()).find({ lifecycle: { $ne: "deprecated" } }).sort({ category: 1, name: 1 }).toArray(),
      (await collections.networks()).find({ enabled: true }).sort({ name: 1 }).toArray(),
      (await collections.dashboardTemplates()).find({ $or: [{ isSystem: true, isPublished: true }, { ownerUserId: request.auth!.userId }] }).sort({ isSystem: -1, name: 1 }).toArray(),
    ]);
    return response.json({ widgets, networks, templates });
  } catch (error) {
    return errorResponse(response, error, "Unable to load model catalog.");
  }
});

modelRoutes.get("/dashboards/:dashboardId/preferences", async (request, response) => {
  const id = userId(request, response);
  if (!id) return;
  if (!(await findDashboardForUser(id, request.params.dashboardId))) return response.status(404).json({ error: "Dashboard not found." });
  const preference = await (await collections.dashboardPreferences()).findOne({ userId: id, dashboardId: request.params.dashboardId });
  return response.json({ preference });
});

const preferenceInput = z.object({
  currency: z.string().trim().regex(/^[A-Z]{3,8}$/).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  refreshIntervalSeconds: z.number().int().min(30).max(3600).optional(),
  autoSave: z.boolean().optional(),
  showArchivedWidgets: z.boolean().optional(),
  defaultWalletIds: z.array(z.string().max(100)).max(100).optional(),
  defaultNetworkIds: z.array(z.string().max(100)).max(30).optional(),
  displayOptions: z.record(z.string(), z.unknown()).optional(),
}).strict();

modelRoutes.put("/dashboards/:dashboardId/preferences", async (request, response) => {
  try {
    const id = userId(request, response);
    if (!id) return;
    const dashboard = await findDashboardForUser(id, request.params.dashboardId);
    if (!dashboard) return response.status(404).json({ error: "Dashboard not found." });
    const input = preferenceInput.parse(request.body);
    const now = new Date();
    const preferenceCollection = await collections.dashboardPreferences();
    await preferenceCollection.updateOne(
      { userId: id, dashboardId: dashboard._id },
      { $set: { ...input, updatedAt: now }, $setOnInsert: { _id: `${id}:${dashboard._id}`, userId: id, dashboardId: dashboard._id, createdAt: now } },
      { upsert: true },
    );
    if (input.currency) await (await collections.dashboards()).updateOne({ _id: dashboard._id, userId: id }, { $set: { currency: input.currency, updatedAt: now } });
    await writeAudit(id, "update_dashboard_preferences", "dashboard", dashboard._id);
    const preference = await preferenceCollection.findOne({ userId: id, dashboardId: dashboard._id });
    return response.json({ preference });
  } catch (error) {
    return errorResponse(response, error, "Unable to save dashboard preferences.");
  }
});

const createTemplateInput = z.object({
  dashboardId: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).optional(),
  category: z.enum(["portfolio", "security", "research", "defi", "custom"]).default("custom"),
}).strict();

modelRoutes.post("/dashboard-templates", async (request, response) => {
  try {
    const id = userId(request, response);
    if (!id) return;
    const input = createTemplateInput.parse(request.body);
    const dashboard = await findDashboardForUser(id, input.dashboardId);
    if (!dashboard) return response.status(404).json({ error: "Dashboard not found." });
    const uiDocument = await ensureUIDocument(id, dashboard._id);
    const now = new Date();
    const template: DashboardTemplateDocument = {
      _id: randomUUID(), ownerUserId: id, name: input.name, description: input.description,
      category: input.category, schemaVersion: 1, theme: dashboard.theme,
      widgets: dashboard.widgets, uiSpec: uiDocument.spec,
      isSystem: false, isPublished: false, createdAt: now, updatedAt: now,
    };
    await (await collections.dashboardTemplates()).insertOne(template);
    await writeAudit(id, "create_dashboard_template", "dashboard_template", template._id);
    return response.status(201).json({ template });
  } catch (error) {
    return errorResponse(response, error, "Unable to save dashboard template.");
  }
});

modelRoutes.post("/dashboard-templates/:templateId/apply", async (request, response) => {
  try {
    const id = userId(request, response);
    if (!id) return;
    const input = z.object({ dashboardId: z.string().min(1).max(100) }).strict().parse(request.body);
    const [dashboard, template] = await Promise.all([
      findDashboardForUser(id, input.dashboardId),
      (await collections.dashboardTemplates()).findOne({ _id: request.params.templateId, $or: [{ isSystem: true, isPublished: true }, { ownerUserId: id }] }),
    ]);
    if (!dashboard || !template) return response.status(404).json({ error: "Dashboard or template not found." });
    const now = new Date();
    const next = { ...dashboard, widgets: template.widgets, theme: (template.theme === "light" || template.theme === "dark" ? template.theme : dashboard.theme), templateId: template._id, updatedAt: now };
    await (await collections.dashboards()).replaceOne({ _id: dashboard._id, userId: id }, next);
    await revisionFor(next, id, "template", `Applied template: ${template.name}`, undefined, now);
    const widgets = template.widgets.filter((widget) => widget.enabled);
    const spec = template.uiSpec
      ? sanitizeUiSpec(template.uiSpec)
      : sanitizeUiSpec({
          ...defaultUiSpec(), title: template.name, description: template.description || `Workspace based on ${template.name}.`,
          components: widgets.map((widget, position) => ({ type: "widget", id: `${widget.type}-${position + 1}`, widgetType: widget.type as WidgetType, title: widget.title, width: widget.width })),
        });
    const document = await saveUiForUser(id, dashboard._id, spec, "system", `Applied template: ${template.name}`);
    const uiRevision = await uiRevisionFor(document, id, "system", `Applied template: ${template.name}`);
    await writeAudit(id, "apply_dashboard_template", "dashboard_template", template._id);
    return response.json({ dashboard: next, uiDocument: document, uiRevision });
  } catch (error) {
    return errorResponse(response, error, "Unable to apply dashboard template.");
  }
});

modelRoutes.get("/notifications", async (request, response) => {
  const id = userId(request, response);
  if (!id) return;
  const status = z.enum(["unread", "read", "archived"]).optional().safeParse(request.query.status);
  if (!status.success) return response.status(400).json({ error: "Invalid notification status." });
  const filter = status.data ? { userId: id, status: status.data } : { userId: id, status: { $ne: "archived" as const } };
  const notifications = await (await collections.notifications()).find(filter).sort({ createdAt: -1 }).limit(50).toArray();
  return response.json({ notifications });
});

modelRoutes.patch("/notifications/:notificationId", async (request, response) => {
  try {
    const id = userId(request, response);
    if (!id) return;
    const { status } = z.object({ status: z.enum(["read", "archived"]) }).strict().parse(request.body);
    const now = new Date();
    const update = status === "read" ? { status, readAt: now } : { status };
    const result = await (await collections.notifications()).findOneAndUpdate(
      { _id: request.params.notificationId, userId: id, status: { $ne: "archived" } },
      { $set: update },
      { returnDocument: "after" },
    );
    if (result) await writeAudit(id, `notification_${status}`, "notification", result._id);
    return result ? response.json({ notification: result }) : response.status(404).json({ error: "Notification not found." });
  } catch (error) {
    return errorResponse(response, error, "Unable to update notification.");
  }
});

modelRoutes.post("/notifications/read-all", async (request, response) => {
  const id = userId(request, response);
  if (!id) return;
  const now = new Date();
  const result = await (await collections.notifications()).updateMany({ userId: id, status: "unread" }, { $set: { status: "read", readAt: now } });
  if (result.modifiedCount) await writeAudit(id, "notifications_read_all", "notification");
  return response.json({ updatedCount: result.modifiedCount });
});

modelRoutes.get("/activity", async (request, response) => {
  const id = userId(request, response);
  if (!id) return;
  const [snapshots, transactions, walletSyncs, transactionSyncs, tokenBalances] = await Promise.all([
    (await collections.snapshots()).find({ userId: id }).sort({ observedAt: -1 }).limit(100).toArray(),
    (await collections.transactions()).find({ userId: id }).sort({ timestamp: -1 }).limit(100).toArray(),
    (await collections.walletSyncs()).find({ userId: id }).sort({ createdAt: -1 }).limit(25).toArray(),
    (await collections.transactionSyncs()).find({ userId: id }).sort({ createdAt: -1 }).limit(25).toArray(),
    (await collections.tokenBalances()).find({ userId: id }).sort({ fetchedAt: -1 }).limit(100).toArray(),
  ]);
  const assetIds = [...new Set(tokenBalances.map((balance) => balance.assetId))];
  const [assets, assetPrices] = assetIds.length
    ? await Promise.all([
        (await collections.assets()).find({ _id: { $in: assetIds } }).toArray(),
        (await collections.assetPrices()).find({ assetId: { $in: assetIds } }).sort({ observedAt: -1 }).limit(100).toArray(),
      ])
    : [[], []];
  return response.json({ snapshots, transactions, walletSyncs, transactionSyncs, tokenBalances, assets, assetPrices });
});

modelRoutes.get("/security/scans", async (request, response) => {
  const id = userId(request, response);
  if (!id) return;
  const scans = await (await collections.securityScans()).find({ userId: id }).sort({ createdAt: -1 }).limit(20).toArray();
  const alerts = await (await collections.securityAlerts()).find({ userId: id, status: "open" }).sort({ detectedAt: -1 }).limit(50).toArray();
  const latestScan = scans[0];
  const checks = latestScan ? await (await collections.securityChecks()).find({ userId: id, scanId: latestScan._id }).sort({ checkedAt: -1 }).toArray() : [];
  return response.json({ scans, alerts, checks, coverage: "Wallet-record validation only. This is not a transaction, contract, or phishing scan." });
});

modelRoutes.post("/security/scans", async (request, response) => {
  try {
    const id = userId(request, response);
    if (!id) return;
    const { scanType } = z.object({ scanType: z.enum(["baseline", "transactions", "approvals", "assets", "full"]).default("baseline") }).strict().parse(request.body);
    if (scanType !== "baseline") return response.status(422).json({ error: "Only baseline wallet-metadata checks are currently supported; transaction and contract scanning are not configured." });
    const scanPermission = await (await collections.permissions()).findOne({ userId: id, featureKey: "security.baseline_scan" });
    if (scanPermission?.enabled === false) return response.status(403).json({ error: "Baseline security checks are disabled in your feature permissions." });
    const user = await (await collections.users()).findOne({ _id: id }, { projection: { "preferences.notifications": 1 } });
    const securityNotificationsEnabled = user?.preferences?.notifications?.security !== false;
    const wallets = await (await collections.wallets()).find({ userId: id, status: { $ne: "removed" } }).toArray();
    const now = new Date();
    const scanId = randomUUID();
    const checks: SecurityCheckDocument[] = [];
    if (!wallets.length) {
      checks.push({ _id: randomUUID(), scanId, userId: id, checkType: "wallet_inventory", result: "unknown", title: "Wallet inventory", explanation: "Add a wallet to validate its stored address and network metadata.", evidence: [], source: "wallet-record-validation", checkedAt: now });
    }
    for (const wallet of wallets) {
      let addressValid = true;
      try { normalizeWalletAddress(wallet.chainFamily, wallet.address); } catch { addressValid = false; }
      checks.push({
        _id: randomUUID(), scanId, userId: id, walletId: wallet._id, checkType: "address_format",
        result: addressValid ? "pass" : "fail",
        title: addressValid ? "Wallet address format" : "Invalid stored wallet address",
        explanation: addressValid ? "The stored public address matches the expected format for its chain." : "The stored public address did not pass chain-format validation. Verify it in the wallet provider.",
        evidence: [{ chainFamily: wallet.chainFamily }], source: "wallet-record-validation", confidence: 1, checkedAt: now,
      });
      const networksConfigured = Array.isArray(wallet.supportedNetworks) && wallet.supportedNetworks.length > 0;
      checks.push({
        _id: randomUUID(), scanId, userId: id, walletId: wallet._id, checkType: "network_configuration",
        result: networksConfigured ? "pass" : "warn",
        title: networksConfigured ? "Network metadata" : "No networks configured",
        explanation: networksConfigured ? "At least one supported network is configured for this wallet." : "This wallet record has no supported networks configured.",
        evidence: [{ networkCount: wallet.supportedNetworks.length }], source: "wallet-record-validation", confidence: 1, checkedAt: now,
      });
    }
    const failedChecks = checks.filter((check) => check.result === "fail" || check.result === "warn");
    const alerts: SecurityAlertDocument[] = [];
    for (const check of failedChecks) {
      const existing = await (await collections.securityAlerts()).findOne({
        userId: id, walletId: check.walletId, category: check.checkType, status: "open",
      });
      if (existing) continue;
      alerts.push({
        _id: randomUUID(), userId: id, walletId: check.walletId, category: check.checkType,
        severity: check.result === "fail" ? "high" : "low", title: check.title, explanation: check.explanation,
        evidence: check.evidence.map((entry) => ({ type: "wallet-record", description: check.explanation, source: check.source, observedAt: now, metadata: entry })),
        source: "wallet-record-validation", confidence: check.confidence, status: "open", detectedAt: now, updatedAt: now,
      });
    }
    const scan: SecurityScanDocument = {
      _id: scanId, userId: id, status: "completed", scanType, checksRun: checks.length,
      alertsCreated: alerts.length, source: "wallet-record-validation", startedAt: now, completedAt: now, createdAt: now,
    };
    await Promise.all([
      (await collections.securityScans()).insertOne(scan),
      (await collections.securityChecks()).insertMany(checks),
    ]);
    if (alerts.length) {
      await (await collections.securityAlerts()).insertMany(alerts);
      if (securityNotificationsEnabled) await (await collections.notifications()).insertMany(alerts.map((alert) => ({
        _id: randomUUID(), userId: id, type: "security" as const, status: "unread" as const,
        title: alert.title, body: alert.explanation, severity: alert.severity === "high" ? "error" as const : "warning" as const,
        resourceType: "security_alert", resourceId: alert._id, createdAt: now,
      })));
    }
    await writeAudit(id, "run_security_baseline", "security_scan", scan._id);
    return response.status(201).json({ scan, checks, alerts, coverage: "Wallet-record validation only. This is not a transaction, contract, or phishing scan." });
  } catch (error) {
    return errorResponse(response, error, "Unable to run wallet metadata checks.");
  }
});

modelRoutes.patch("/security/alerts/:alertId", async (request, response) => {
  try {
    const id = userId(request, response);
    if (!id) return;
    const { status } = z.object({ status: z.enum(["acknowledged", "resolved", "dismissed"]) }).strict().parse(request.body);
    const now = new Date();
    const result = await (await collections.securityAlerts()).findOneAndUpdate(
      { _id: request.params.alertId, userId: id, status: { $in: ["open", "acknowledged"] } },
      { $set: { status, updatedAt: now, ...(status === "acknowledged" ? { acknowledgedAt: now } : {}), ...(status === "resolved" ? { resolvedAt: now } : {}) } },
      { returnDocument: "after" },
    );
    if (result) await writeAudit(id, `security_alert_${status}`, "security_alert", result._id);
    return result ? response.json({ alert: result }) : response.status(404).json({ error: "Open alert not found." });
  } catch (error) {
    return errorResponse(response, error, "Unable to update security alert.");
  }
});

modelRoutes.get("/ai/usage", async (request, response) => {
  const id = userId(request, response);
  if (!id) return;
  const usage = await (await collections.aiUsage()).find({ userId: id }).sort({ periodStart: -1 }).limit(30).toArray();
  const edits = await (await collections.aiEdits()).find({ userId: id }).sort({ createdAt: -1 }).limit(50).toArray();
  return response.json({ usage, edits });
});

modelRoutes.get("/integrations", async (request, response) => {
  const id = userId(request, response);
  if (!id) return;
  const integrations = await (await collections.integrations()).find({ userId: id }).sort({ updatedAt: -1 }).toArray();
  return response.json({
    integrations: integrations.map(({ credentialReference: _credentialReference, ...integration }) => integration),
    supportedAdapters: [],
    message: "No external exchange or notification adapters are configured. Credentials are not accepted by this endpoint.",
  });
});
