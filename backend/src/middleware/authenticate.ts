import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { collections } from "../db.js";
import { clearSessionCookie, sessionCookieName } from "../controllers/authController.js";

export interface AuthContext {
  userId: string;
  sessionId: string;
  expiresAt: Date;
  role: "user" | "admin";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function readCookie(request: Request, name: string) {
  const header = request.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function readToken(request: Request) {
  const authorization = request.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length).trim();
  return readCookie(request, sessionCookieName());
}

export async function authenticate(request: Request, response: Response, next: NextFunction) {
  try {
    const token = readToken(request);
    if (!token) return response.status(401).json({ error: "Authentication required." });
    const session = await (await collections.sessions()).findOne({ tokenHash: sha256(token), status: "active" });
    if (!session) {
      clearSessionCookie(response);
      return response.status(401).json({ error: "Session is invalid or revoked." });
    }
    if (session.expiresAt <= new Date()) {
      await (await collections.sessions()).updateOne({ _id: session._id, status: "active" }, { $set: { status: "expired" } });
      clearSessionCookie(response);
      return response.status(401).json({ error: "Session has expired." });
    }
    const user = await (await collections.users()).findOne({ _id: session.userId });
    if (!user || user.status !== "active") return response.status(403).json({ error: "This account is not active." });
    await (await collections.sessions()).updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } });
    request.auth = { userId: session.userId, sessionId: session._id, expiresAt: session.expiresAt, role: user.role || "user" };
    return next();
  } catch (error) {
    return response.status(401).json({ error: error instanceof Error ? error.message : "Authentication failed." });
  }
}
