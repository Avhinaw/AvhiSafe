import { Router } from "express";
import { z } from "zod";
import { loadPortfolioAddress } from "../portfolioService.js";

const portfolioAddress = z.object({
  id: z.string().min(1).max(120),
  label: z.string().max(160),
  address: z.string().min(20).max(128),
  chain: z.enum(["ethereum", "solana"]),
  source: z.enum(["wallet", "watch", "connected"]),
}).strict();

const portfolioInput = z.object({ addresses: z.array(portfolioAddress).min(1).max(50) }).strict();

export const portfolioRoutes = Router();

portfolioRoutes.post("/", async (request, response) => {
  try {
    const input = portfolioInput.parse(request.body);
    const snapshots = await Promise.all(input.addresses.map(loadPortfolioAddress));
    return response.json({ snapshots, fetchedAt: new Date().toISOString(), providerMode: "backend-adapters" });
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid portfolio request." });
  }
});
