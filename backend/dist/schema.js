import { sql } from "drizzle-orm";
import { bigint, boolean, index, int, json, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
export const users = mysqlTable("users", {
    id: varchar("id", { length: 64 }).primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 120 }),
    avatarUrl: varchar("avatar_url", { length: 512 }),
    role: mysqlEnum("role", ["user", "admin"]).notNull().default("user"),
    createdAt: timestamp("created_at").notNull().default(sql `CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql `CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => ({ emailIndex: uniqueIndex("users_email_unique").on(table.email) }));
export const workspaces = mysqlTable("workspaces", {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull().default("My AvhiSafe workspace"),
    theme: mysqlEnum("theme", ["light", "dark", "system"]).notNull().default("system"),
    currency: varchar("currency", { length: 8 }).notNull().default("USD"),
    density: mysqlEnum("density", ["comfortable", "compact", "analytics"]).notNull().default("comfortable"),
    isDefault: boolean("is_default").notNull().default(true),
    createdAt: timestamp("created_at").notNull().default(sql `CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql `CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => ({ userIndex: index("workspaces_user_idx").on(table.userId) }));
export const workspaceWidgets = mysqlTable("workspace_widgets", {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 64 }).notNull(),
    widgetType: varchar("widget_type", { length: 80 }).notNull(),
    title: varchar("title", { length: 160 }),
    enabled: boolean("enabled").notNull().default(true),
    position: int("position").notNull().default(0),
    width: mysqlEnum("width", ["small", "medium", "large", "full"]).notNull().default("medium"),
    config: json("config").$type().notNull().default({}),
    createdAt: timestamp("created_at").notNull().default(sql `CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql `CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => ({ workspacePositionIndex: index("widgets_workspace_position_idx").on(table.workspaceId, table.position) }));
export const workspaceRevisions = mysqlTable("workspace_revisions", {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 64 }).notNull(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    source: mysqlEnum("source", ["manual", "ai", "system"]).notNull(),
    prompt: varchar("prompt", { length: 4000 }),
    summary: varchar("summary", { length: 500 }).notNull(),
    snapshot: json("snapshot").$type().notNull(),
    createdAt: timestamp("created_at").notNull().default(sql `CURRENT_TIMESTAMP`),
}, (table) => ({ workspaceIndex: index("revisions_workspace_created_idx").on(table.workspaceId, table.createdAt) }));
export const aiRequests = mysqlTable("ai_requests", {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    workspaceId: varchar("workspace_id", { length: 64 }),
    prompt: varchar("prompt", { length: 8000 }).notNull(),
    intent: varchar("intent", { length: 80 }),
    status: mysqlEnum("status", ["planned", "approved", "applied", "rejected", "failed"]).notNull().default("planned"),
    response: json("response").$type(),
    createdAt: timestamp("created_at").notNull().default(sql `CURRENT_TIMESTAMP`),
    completedAt: timestamp("completed_at"),
}, (table) => ({ userCreatedIndex: index("ai_requests_user_created_idx").on(table.userId, table.createdAt) }));
export const connectedWallets = mysqlTable("connected_wallets", {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    chain: mysqlEnum("chain", ["ethereum", "solana"]).notNull(),
    address: varchar("address", { length: 128 }).notNull(),
    provider: varchar("provider", { length: 120 }).notNull(),
    label: varchar("label", { length: 120 }),
    chainId: varchar("chain_id", { length: 32 }),
    lastSeenAt: timestamp("last_seen_at").notNull().default(sql `CURRENT_TIMESTAMP`),
    createdAt: timestamp("created_at").notNull().default(sql `CURRENT_TIMESTAMP`),
}, (table) => ({ userAddressUnique: uniqueIndex("connected_wallet_user_chain_address_unique").on(table.userId, table.chain, table.address), userIndex: index("connected_wallets_user_idx").on(table.userId) }));
export const publicAddresses = mysqlTable("public_addresses", {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    chain: mysqlEnum("chain", ["ethereum", "solana"]).notNull(),
    address: varchar("address", { length: 128 }).notNull(),
    label: varchar("label", { length: 120 }),
    notes: varchar("notes", { length: 1000 }),
    source: mysqlEnum("source", ["watch", "generated", "connected"]).notNull().default("watch"),
    createdAt: timestamp("created_at").notNull().default(sql `CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at").notNull().default(sql `CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => ({ userAddressUnique: uniqueIndex("public_addresses_user_chain_address_unique").on(table.userId, table.chain, table.address), userIndex: index("public_addresses_user_idx").on(table.userId) }));
export const featurePermissions = mysqlTable("feature_permissions", {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    featureKey: varchar("feature_key", { length: 100 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    config: json("config").$type().notNull().default({}),
    updatedAt: timestamp("updated_at").notNull().default(sql `CURRENT_TIMESTAMP`).onUpdateNow(),
}, (table) => ({ userFeatureUnique: uniqueIndex("feature_permissions_user_feature_unique").on(table.userId, table.featureKey) }));
export const portfolioSnapshots = mysqlTable("portfolio_snapshots", {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    chain: mysqlEnum("chain", ["ethereum", "solana"]).notNull(),
    address: varchar("address", { length: 128 }).notNull(),
    totalValueUsd: bigint("total_value_usd", { mode: "number" }).notNull().default(0),
    payload: json("payload").$type().notNull(),
    capturedAt: timestamp("captured_at").notNull().default(sql `CURRENT_TIMESTAMP`),
}, (table) => ({ userCapturedIndex: index("portfolio_snapshots_user_captured_idx").on(table.userId, table.capturedAt) }));
