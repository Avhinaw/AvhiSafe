import { eq, and, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { featurePermissions, publicAddresses, users, workspaceRevisions, workspaceWidgets, workspaces } from "@/drizzle/schema";

let pool: mysql.Pool | undefined;

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  pool ??= mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

export function getDb() {
  return drizzle(getPool());
}

export async function getUserById(userId: string) {
  return getDb().select().from(users).where(eq(users.id, userId)).limit(1);
}

export async function getUserWorkspace(userId: string) {
  const db = getDb();
  const rows = await db.select().from(workspaces).where(and(eq(workspaces.userId, userId), eq(workspaces.isDefault, true))).limit(1);
  return rows[0] || null;
}

export async function getWorkspaceWidgets(userId: string, workspaceId: string) {
  const db = getDb();
  const workspace = await db.select({ id: workspaces.id }).from(workspaces).where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId))).limit(1);
  if (!workspace[0]) throw new Error("Workspace not found.");
  return db.select().from(workspaceWidgets).where(eq(workspaceWidgets.workspaceId, workspaceId)).orderBy(asc(workspaceWidgets.position));
}

export async function getUserPublicAddresses(userId: string) {
  return getDb().select().from(publicAddresses).where(eq(publicAddresses.userId, userId));
}

export async function getUserFeaturePermissions(userId: string) {
  return getDb().select().from(featurePermissions).where(eq(featurePermissions.userId, userId));
}

export async function addWorkspaceRevision(input: typeof workspaceRevisions.$inferInsert) {
  await getDb().insert(workspaceRevisions).values(input);
}
