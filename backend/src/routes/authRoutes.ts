import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { currentUser, deleteAccount, exportAccount, issueNonce, logout, revokeSession, verifyNonce } from "../controllers/authController.js";
import { rateLimit } from "../middleware/security.js";

export const authRoutes = Router();
const authAttemptLimit = rateLimit({ windowMs: 60_000, max: 20, message: "Too many authentication attempts. Please try again later." });
authRoutes.post("/nonce", authAttemptLimit, issueNonce);
authRoutes.post("/verify", authAttemptLimit, verifyNonce);
authRoutes.get("/me", authenticate, currentUser);
authRoutes.post("/logout", authenticate, logout);
authRoutes.post("/sessions/:sessionId/revoke", authenticate, revokeSession);
authRoutes.get("/export", authenticate, exportAccount);
authRoutes.delete("/account", authAttemptLimit, authenticate, deleteAccount);
