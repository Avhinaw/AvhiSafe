import { Router } from "express";
import { collections } from "../db.js";
import { rateLimit } from "../middleware/security.js";

export const securityRoutes = Router();
securityRoutes.use(rateLimit({ windowMs: 60_000, max: 20, message: "Too many security requests. Please try again shortly." }));

securityRoutes.get("/alerts", async (request, response) => {
  if (!request.auth) return response.status(401).json({ error: "Authentication required." });
  const alerts = await (await collections.securityAlerts()).find({ userId: request.auth.userId }).sort({ updatedAt: -1 }).limit(100).toArray();
  return response.json({ alerts });
});
