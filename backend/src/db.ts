import { MongoClient, type Db } from "mongodb";
import { randomUUID } from "node:crypto";
import { defaultWidgets } from "./widgetCatalog.js";
import { defaultUiSpec } from "./uiSchema.js";
import type { AIRequestDocument, ConnectedWalletDocument, DashboardDocument, DashboardRevisionDocument, FeaturePermissionDocument, PortfolioSnapshotDocument, PublicAddressDocument, UIDocument, UIRevisionDocument, UserDocument } from "./models/index.js";

let client: MongoClient | undefined;
let database: Db | undefined;

export async function getDb(): Promise<Db> {
  if (database) return database;
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "avhisafe";
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  client ??= new MongoClient(uri);
  await client.connect();
  database = client.db(dbName);
  return database;
}

export const collections = {
  users: async () => (await getDb()).collection<UserDocument>("users"),
  dashboards: async () => (await getDb()).collection<DashboardDocument>("dashboards"),
  revisions: async () => (await getDb()).collection<DashboardRevisionDocument>("dashboard_revisions"),
  aiRequests: async () => (await getDb()).collection<AIRequestDocument>("ai_requests"),
  permissions: async () => (await getDb()).collection<FeaturePermissionDocument>("feature_permissions"),
  wallets: async () => (await getDb()).collection<ConnectedWalletDocument>("connected_wallets"),
  addresses: async () => (await getDb()).collection<PublicAddressDocument>("public_addresses"),
  snapshots: async () => (await getDb()).collection<PortfolioSnapshotDocument>("portfolio_snapshots"),
  uiDocuments: async () => (await getDb()).collection<UIDocument>("ai_ui_documents"),
  uiRevisions: async () => (await getDb()).collection<UIRevisionDocument>("ai_ui_revisions"),
};

export async function findDefaultDashboard(userId: string) {
  return (await collections.dashboards()).findOne({ userId, isDefault: true });
}

export async function ensureDefaultDashboard(userId: string): Promise<DashboardDocument> {
  const existing = await findDefaultDashboard(userId);
  if (existing) {
    await ensureUIDocument(userId, existing._id);
    return existing;
  }
  const now = new Date();
  const dashboard: DashboardDocument = {
    _id: randomUUID(), userId, slug: "main", name: "My AvhiSafe dashboard", theme: "system", currency: "USD", density: "comfortable", isDefault: true,
    widgets: defaultWidgets(), filters: {}, createdAt: now, updatedAt: now,
  };
  const dashboards = await collections.dashboards();
  await dashboards.updateOne({ userId, isDefault: true }, { $setOnInsert: dashboard }, { upsert: true });
  const saved = (await findDefaultDashboard(userId)) || dashboard;
  await ensureUIDocument(userId, saved._id);
  return saved;
}

export async function findDashboardForUser(userId: string, dashboardId: string) {
  return (await collections.dashboards()).findOne({ _id: dashboardId, userId });
}

export async function listUserDashboards(userId: string) {
  return (await collections.dashboards()).find({ userId }).sort({ updatedAt: -1 }).toArray();
}

export async function listUserRevisions(userId: string, dashboardId: string) {
  return (await collections.revisions()).find({ userId, dashboardId }).sort({ createdAt: -1 }).limit(50).toArray();
}

export async function findUIDocumentForUser(userId: string, dashboardId: string) {
  return (await collections.uiDocuments()).findOne({ userId, dashboardId });
}

export async function ensureUIDocument(userId: string, dashboardId: string) {
  const now = new Date();
  const document: UIDocument = { _id: `${userId}:${dashboardId}`, userId, dashboardId, version: 1, source: "system", spec: defaultUiSpec(), createdAt: now, updatedAt: now };
  await (await collections.uiDocuments()).updateOne({ userId, dashboardId }, { $setOnInsert: document }, { upsert: true });
  const saved = (await findUIDocumentForUser(userId, dashboardId)) || document;
  const hasRevision = await (await collections.uiRevisions()).findOne({ userId, dashboardId }, { projection: { _id: 1 } });
  if (!hasRevision) await (await collections.uiRevisions()).insertOne({ _id: randomUUID(), userId, dashboardId, source: "system", summary: "Initial generated UI", spec: saved.spec, createdAt: saved.createdAt });
  return saved;
}

export async function listUIRevisions(userId: string, dashboardId: string) {
  return (await collections.uiRevisions()).find({ userId, dashboardId }).sort({ createdAt: -1 }).limit(50).toArray();
}

export async function saveUIDocument(document: UIDocument) {
  await (await collections.uiDocuments()).replaceOne({ userId: document.userId, dashboardId: document.dashboardId }, document, { upsert: true });
  return document;
}

export async function createUIRevision(revision: UIRevisionDocument) {
  await (await collections.uiRevisions()).insertOne(revision);
  return revision;
}

export async function listUserPublicAddresses(userId: string) {
  return (await collections.addresses()).find({ userId }).sort({ updatedAt: -1 }).toArray();
}

export async function listUserWallets(userId: string) {
  return (await collections.wallets()).find({ userId }).sort({ lastSeenAt: -1 }).toArray();
}

export async function listUserPermissions(userId: string) {
  return (await collections.permissions()).find({ userId }).sort({ featureKey: 1 }).toArray();
}

export async function createDashboardRevision(input: DashboardRevisionDocument) {
  await (await collections.revisions()).insertOne(input);
}

export async function pingDatabase() {
  await (await getDb()).command({ ping: 1 });
  return true;
}

export async function closeDatabase() {
  if (client) await client.close();
  client = undefined;
  database = undefined;
}
