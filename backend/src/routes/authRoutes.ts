import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { currentUser, issueNonce, logout, revokeSession, verifyNonce } from "../controllers/authController.js";

export const authRoutes = Router();
authRoutes.post("/nonce", issueNonce);
authRoutes.post("/verify", verifyNonce);
authRoutes.get("/me", authenticate, currentUser);
authRoutes.post("/logout", authenticate, logout);
authRoutes.post("/sessions/:sessionId/revoke", authenticate, revokeSession);
