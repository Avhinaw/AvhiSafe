import { MongoClient, type Db } from "mongodb";
import type { AIRequestDocument, ConnectedWalletDocument, DashboardDocument, DashboardRevisionDocument, FeaturePermissionDocument, PortfolioSnapshotDocument, PublicAddressDocument, UserDocument } from "./models.js";

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
};

export async function findDefaultDashboard(userId: string) {
  return (await collections.dashboards()).findOne({ userId, isDefault: true });
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
