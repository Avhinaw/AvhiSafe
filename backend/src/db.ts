import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { and, asc, eq } from "drizzle-orm";
import { featurePermissions, publicAddresses, users, workspaceRevisions, workspaceWidgets, workspaces } from "./schema.js";

let pool: mysql.Pool | undefined;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  pool ??= mysql.createPool(url);
  return drizzle(pool);
}

export async function findUser(userId: string) {
  return getDb().select().from(users).where(eq(users.id, userId)).limit(1);
}

export async function findDefaultWorkspace(userId: string) {
  const rows = await getDb().select().from(workspaces).where(and(eq(workspaces.userId, userId), eq(workspaces.isDefault, true))).limit(1);
  return rows[0] ?? null;
}

export async function listWidgets(userId: string, workspaceId: string) {
  const workspace = await getDb().select({ id: workspaces.id }).from(workspaces).where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId))).limit(1);
  if (!workspace[0]) throw new Error("Workspace not found.");
  return getDb().select().from(workspaceWidgets).where(eq(workspaceWidgets.workspaceId, workspaceId)).orderBy(asc(workspaceWidgets.position));
}

export async function listPublicAddresses(userId: string) {
  return getDb().select().from(publicAddresses).where(eq(publicAddresses.userId, userId));
}

export async function listFeaturePermissions(userId: string) {
  return getDb().select().from(featurePermissions).where(eq(featurePermissions.userId, userId));
}

export async function createRevision(input: typeof workspaceRevisions.$inferInsert) {
  await getDb().insert(workspaceRevisions).values(input);
}
