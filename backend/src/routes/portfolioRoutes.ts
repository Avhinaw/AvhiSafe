import { Router } from "express";
import { z } from "zod";
import { collections } from "../db.js";
import { rateLimit } from "../middleware/security.js";
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
    return response.json({ snapshots, fetchedAt: new Date().toISOString(), providerMode: "backend-adapters" });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid portfolio request." });
  }
});
