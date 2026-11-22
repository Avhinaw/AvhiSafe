import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { collections } from "../db.js";
import { rateLimit } from "../middleware/security.js";
import type { PortfolioSnapshotDocument } from "../models/index.js";
import { loadPortfolioAddress } from "../portfolioService.js";
import { normalizeWalletAddress } from "../walletValidation.js";

const portfolioAddress = z.object({
  id: z.string().min(1).max(120),
  label: z.string().max(160),
  address: z.string().min(20).max(128),
  chain: z.enum(["ethereum", "solana"]),
  source: z.enum(["wallet", "watch", "connected"]),
}).strict();

const portfolioInput = z.object({ addresses: z.array(portfolioAddress).min(1).max(50) }).strict();

export const portfolioRoutes = Router();
portfolioRoutes.use(rateLimit({ windowMs: 60_000, max: 30, message: "Too many portfolio refreshes. Please try again shortly." }));

portfolioRoutes.post("/", async (request, response) => {
  try {
    const input = portfolioInput.parse(request.body);
    if (!request.auth) return response.status(401).json({ error: "Authentication required." });
    const requested = input.addresses.map((address) => ({ ...address, normalizedAddress: normalizeWalletAddress(address.chain, address.address) }));
    const ownedWallets = await (await collections.wallets()).find({
      userId: request.auth.userId,
      status: "active",
      $or: requested.map((address) => ({ chainFamily: address.chain, normalizedAddress: address.normalizedAddress })),
    }).toArray();
    const ownedKeys = new Set(ownedWallets.map((wallet) => `${wallet.chainFamily}:${wallet.normalizedAddress}`));
    const unauthorized = requested.find((address) => !ownedKeys.has(`${address.chain}:${address.normalizedAddress}`));
    if (unauthorized) return response.status(403).json({ error: "Portfolio requests may only include active wallets owned by the signed-in account." });
    const snapshots = await Promise.all(requested.map(({ normalizedAddress: _normalizedAddress, ...address }) => loadPortfolioAddress(address)));
    const walletByKey = new Map(ownedWallets.map((wallet) => [`${wallet.chainFamily}:${wallet.normalizedAddress}`, wallet]));
    const now = new Date();
    const documents: PortfolioSnapshotDocument[] = snapshots.map((snapshot) => {
      const wallet = walletByKey.get(`${snapshot.address.chain}:${normalizeWalletAddress(snapshot.address.chain, snapshot.address.address)}`);
      const value = (snapshot.nativeValueUsd || 0) + snapshot.tokens.reduce((sum, token) => sum + (token.valueUsd || 0), 0);
      return {
        _id: randomUUID(),
        userId: request.auth!.userId,
        walletId: wallet!._id,
        networkId: wallet!.supportedNetworks[0] || "unknown",
        assetId: "portfolio:total",
        quantity: String(value),
        price: value,
        value,
        currency: "USD",
        source: snapshot.source,
        dataQuality: snapshot.dataQuality,
        observedAt: now,
        fetchedAt: now,
        rawSourceId: snapshot.address.address,
        payload: snapshot as unknown as Record<string, unknown>,
      };
    });
    if (documents.length) await (await collections.snapshots()).insertMany(documents, { ordered: false });
    return response.json({ snapshots, fetchedAt: new Date().toISOString(), providerMode: "backend-adapters" });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid portfolio request." });
  }
});

portfolioRoutes.get("/history", async (request, response) => {
  try {
    if (!request.auth) return response.status(401).json({ error: "Authentication required." });
    const limit = Math.min(Math.max(Number(request.query.limit) || 100, 1), 500);
    const snapshots = await (await collections.snapshots()).find({ userId: request.auth.userId, assetId: "portfolio:total" }).sort({ fetchedAt: -1 }).limit(limit).toArray();
    return response.json({ history: snapshots.reverse().map((snapshot) => ({ timestamp: snapshot.fetchedAt.getTime(), value: snapshot.value || Number(snapshot.quantity) || 0, walletId: snapshot.walletId, source: snapshot.source, dataQuality: snapshot.dataQuality })) });
  } catch (error) {
    return response.status(500).json({ error: error instanceof Error ? error.message : "Unable to load portfolio history." });
  }
});
