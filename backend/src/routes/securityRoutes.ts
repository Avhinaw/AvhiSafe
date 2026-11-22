import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { collections } from "../db.js";
import { rateLimit } from "../middleware/security.js";
import type { SecurityCheckDocument, SecurityScanDocument } from "../models/index.js";

const scanInput = z.object({ walletId: z.string().min(1).max(120).optional(), scanType: z.enum(["baseline", "transactions", "approvals", "assets", "full"]).default("baseline") }).strict();
const alertPatch = z.object({ status: z.enum(["acknowledged", "resolved", "dismissed", "open"]) }).strict();

export const securityRoutes = Router();
securityRoutes.use(rateLimit({ windowMs: 60_000, max: 20, message: "Too many security requests. Please try again shortly." }));

securityRoutes.get("/alerts", async (request, response) => {
  if (!request.auth) return response.status(401).json({ error: "Authentication required." });
  const alerts = await (await collections.securityAlerts()).find({ userId: request.auth.userId }).sort({ updatedAt: -1 }).limit(100).toArray();
  return response.json({ alerts });
});

securityRoutes.get("/scans", async (request, response) => {
  if (!request.auth) return response.status(401).json({ error: "Authentication required." });
  const scans = await (await collections.securityScans()).find({ userId: request.auth.userId }).sort({ createdAt: -1 }).limit(30).toArray();
  return response.json({ scans });
});

securityRoutes.post("/scan", async (request, response) => {
  try {
    if (!request.auth) return response.status(401).json({ error: "Authentication required." });
    const input = scanInput.parse(request.body);
    const wallets = await (await collections.wallets()).find({ userId: request.auth.userId, status: "active", ...(input.walletId ? { _id: input.walletId } : {}) }).toArray();
    if (input.walletId && !wallets.length) return response.status(404).json({ error: "Wallet not found." });
    const now = new Date();
    const scan: SecurityScanDocument = { _id: randomUUID(), userId: request.auth.userId, walletId: input.walletId, status: "running", scanType: input.scanType, checksRun: 0, alertsCreated: 0, source: "local-deterministic", startedAt: now, createdAt: now };
    await (await collections.securityScans()).insertOne(scan);
    const checks: SecurityCheckDocument[] = wallets.map((wallet) => ({
      _id: randomUUID(), scanId: scan._id, userId: request.auth!.userId, walletId: wallet._id, networkId: wallet.supportedNetworks[0], checkType: "read_only_boundary", result: "pass", title: "Read-only custody boundary", explanation: "AvhiSafe does not expose transaction signing or private-key operations in this product surface.", evidence: [{ transactionSigningEnabled: false, privateKeysSentToBackend: false, checkedAt: now.toISOString() }], source: "avhisafe-policy", confidence: 1, checkedAt: now,
    }));
    if (checks.length) await (await collections.securityChecks()).insertMany(checks);
    const completed: SecurityScanDocument = { ...scan, status: "completed", checksRun: checks.length, alertsCreated: 0, completedAt: new Date() };
    await (await collections.securityScans()).replaceOne({ _id: scan._id, userId: request.auth.userId }, completed);
    return response.status(201).json({ scan: completed, checks, alerts: [] });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Unable to run security scan." });
  }
});

securityRoutes.patch("/alerts/:alertId", async (request, response) => {
  try {
    if (!request.auth) return response.status(401).json({ error: "Authentication required." });
    const input = alertPatch.parse(request.body);
    const now = new Date();
    const result = await (await collections.securityAlerts()).findOneAndUpdate({ _id: request.params.alertId, userId: request.auth.userId }, { $set: { status: input.status, updatedAt: now, ...(input.status === "acknowledged" ? { acknowledgedAt: now } : {}), ...(input.status === "resolved" ? { resolvedAt: now } : {}) } }, { returnDocument: "after" });
    return result ? response.json({ alert: result }) : response.status(404).json({ error: "Security alert not found." });
  } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid security alert update." }); }
});
