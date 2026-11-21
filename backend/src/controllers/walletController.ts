import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { getAddress } from "ethers";
import bs58 from "bs58";
import { z } from "zod";
import { collections } from "../db.js";
import type { WalletDocument } from "../models/index.js";

const createInput = z.object({ chainFamily: z.enum(["ethereum", "solana"]), address: z.string().trim().min(20).max(128), supportedNetworks: z.array(z.string().trim().min(1).max(80)).min(1).max(30), label: z.string().trim().max(120).optional(), provider: z.string().trim().max(120).optional(), connectionId: z.string().trim().max(160).optional() }).strict();
const patchInput = z.object({ label: z.string().trim().max(120).nullable().optional(), status: z.enum(["active", "hidden", "archived", "disconnected", "removed"]).optional(), supportedNetworks: z.array(z.string().trim().min(1).max(80)).min(1).max(30).optional() }).strict();

function errorResponse(response: Response, error: unknown, fallback: string, status = 400) { return response.status(status).json({ error: error instanceof Error ? error.message : fallback }); }

function normalizeAddress(chainFamily: "ethereum" | "solana", address: string) {
  if (chainFamily === "ethereum") return getAddress(address).toLowerCase();
  const decoded = bs58.decode(address);
  if (decoded.length !== 32) throw new Error("Invalid Solana address.");
  return bs58.encode(decoded);
}

function displayAddress(chainFamily: "ethereum" | "solana", normalizedAddress: string) { return chainFamily === "ethereum" ? getAddress(normalizedAddress) : normalizedAddress; }

function requireUser(request: Request, response: Response) {
  if (!request.auth) { response.status(401).json({ error: "Authentication required." }); return undefined; }
  return request.auth.userId;
}

async function createWallet(request: Request, response: Response, sourceType: "connected" | "watch_only") {
  try {
    const userId = requireUser(request, response);
    if (!userId) return;
    const input = createInput.parse(request.body);
    if (sourceType === "connected" && !input.provider) return errorResponse(response, new Error("A wallet provider is required for connected wallets."), "A wallet provider is required for connected wallets.");
    const normalizedAddress = normalizeAddress(input.chainFamily, input.address);
    const wallets = await collections.wallets();
    const existing = await wallets.findOne({ userId, chainFamily: input.chainFamily, normalizedAddress, status: { $ne: "removed" } });
    if (existing) return response.status(409).json({ error: "This wallet is already connected to the user account.", wallet: existing });
    const now = new Date();
    const wallet: WalletDocument = { _id: randomUUID(), userId, chainFamily: input.chainFamily, address: displayAddress(input.chainFamily, normalizedAddress), normalizedAddress, label: input.label, sourceType, supportedNetworks: input.supportedNetworks, status: "active", provider: input.provider, connectionId: input.connectionId, createdBy: "user", createdAt: now, updatedAt: now };
    await wallets.insertOne(wallet);
    return response.status(201).json({ wallet });
  } catch (error) {
    return errorResponse(response, error, "Unable to add wallet.");
  }
}

export async function listWallets(request: Request, response: Response) {
  const userId = requireUser(request, response);
  if (!userId) return;
  const wallets = await collections.wallets();
  return response.json({ wallets: await wallets.find({ userId, status: { $ne: "removed" } }).sort({ updatedAt: -1 }).toArray() });
}

export async function addWatchOnlyWallet(request: Request, response: Response) { return createWallet(request, response, "watch_only"); }
export async function connectWallet(request: Request, response: Response) { return createWallet(request, response, "connected"); }

export async function updateWallet(request: Request, response: Response) {
  try {
    const userId = requireUser(request, response);
    if (!userId) return;
    const patch = patchInput.parse(request.body);
    const { label, ...rest } = patch;
    const updates = { ...rest, updatedAt: new Date() };
    const update: Record<string, unknown> = { $set: updates };
    if (label === null) update.$unset = { label: "" };
    else if (label !== undefined) (updates as { label?: string }).label = label;
    const result = await (await collections.wallets()).findOneAndUpdate({ _id: request.params.walletId, userId, status: { $ne: "removed" } }, update, { returnDocument: "after" });
    if (!result) return response.status(404).json({ error: "Wallet not found." });
    return response.json({ wallet: result });
  } catch (error) { return errorResponse(response, error, "Unable to update wallet."); }
}

export async function removeWallet(request: Request, response: Response) {
  const userId = requireUser(request, response);
  if (!userId) return;
  const result = await (await collections.wallets()).updateOne({ _id: request.params.walletId, userId, status: { $ne: "removed" } }, { $set: { status: "removed", updatedAt: new Date() } });
  return result.matchedCount ? response.status(204).send() : response.status(404).json({ error: "Wallet not found." });
}
