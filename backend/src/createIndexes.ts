import "dotenv/config";
import { collections, getDb } from "./db.js";

const db = await getDb();
await db.collection("users").createIndex({ email: 1 }, { unique: true });
await db.collection("dashboards").createIndex({ userId: 1, slug: 1 }, { unique: true });
await db.collection("dashboards").createIndex({ userId: 1, isDefault: 1 });
await db.collection("dashboard_revisions").createIndex({ userId: 1, dashboardId: 1, createdAt: -1 });
await db.collection("ai_requests").createIndex({ userId: 1, createdAt: -1 });
await db.collection("feature_permissions").createIndex({ userId: 1, featureKey: 1 }, { unique: true });
await db.collection("connected_wallets").createIndex({ userId: 1, chain: 1, address: 1 }, { unique: true });
await db.collection("public_addresses").createIndex({ userId: 1, chain: 1, address: 1 }, { unique: true });
await db.collection("portfolio_snapshots").createIndex({ userId: 1, address: 1, capturedAt: -1 });
await db.collection("ai_ui_documents").createIndex({ userId: 1, dashboardId: 1 }, { unique: true });
await db.collection("ai_ui_revisions").createIndex({ userId: 1, dashboardId: 1, createdAt: -1 });
console.log("AvhiSafe MongoDB indexes created.");
await collections.users();
process.exit(0);
