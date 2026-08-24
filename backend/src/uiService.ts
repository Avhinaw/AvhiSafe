import { randomUUID } from "node:crypto";
import { createUIRevision, findUIDocumentForUser, saveUIDocument } from "./db.js";
import type { UIDocument, UIRevisionDocument } from "./models/index.js";
import type { UISpec } from "./uiSchema.js";

export async function saveUiForUser(userId: string, dashboardId: string, spec: UISpec, source: UIDocument["source"], prompt?: string, now = new Date()) {
  const previous = await findUIDocumentForUser(userId, dashboardId);
  const document: UIDocument = { _id: `${userId}:${dashboardId}`, userId, dashboardId, version: (previous?.version || 0) + 1, source, prompt, spec, createdAt: previous?.createdAt || now, updatedAt: now };
  const existing = await saveUIDocument(document);
  return existing;
}

export async function uiRevisionFor(document: UIDocument, userId: string, source: UIRevisionDocument["source"], summary: string, prompt?: string, now = new Date()) {
  const revision: UIRevisionDocument = { _id: randomUUID(), userId, dashboardId: document.dashboardId, source, prompt, summary, spec: document.spec, createdAt: now };
  await createUIRevision(revision);
  return revision;
}
