import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { collections } from "../db.js";
import { authenticate } from "../middleware/authenticate.js";
import type { EncryptedVaultDocument } from "../models/index.js";

const vaultInput = z.object({ version: z.literal(1), salt: z.string().min(16).max(256), iv: z.string().min(8).max(128), ciphertext: z.string().min(1).max(2_000_000) }).strict();
export const vaultRoutes = Router();
vaultRoutes.use(authenticate);

vaultRoutes.get("/", async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) return response.status(401).json({ error: "Authentication required." });
  const vault = await (await collections.encryptedVaults()).findOne({ userId });
  return response.json({ vault: vault ? { version: vault.version, salt: vault.salt, iv: vault.iv, ciphertext: vault.ciphertext, updatedAt: vault.updatedAt } : null });
});

vaultRoutes.put("/", async (request, response) => {
  try {
    const userId = request.auth?.userId;
    if (!userId) return response.status(401).json({ error: "Authentication required." });
    const input = vaultInput.parse(request.body);
    const now = new Date();
    const vault: EncryptedVaultDocument = { _id: `${userId}:vault`, userId, ...input, createdAt: now, updatedAt: now };
    await (await collections.encryptedVaults()).replaceOne({ userId }, vault, { upsert: true });
    return response.json({ saved: true, updatedAt: now });
  } catch (error) { return response.status(400).json({ error: error instanceof Error ? error.message : "Unable to save encrypted vault." }); }
});
