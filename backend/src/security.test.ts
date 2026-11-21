import assert from "node:assert/strict";
import { authenticatedUserId, trustedOriginMiddleware } from "./middleware/requestSecurity.js";
import type { Request, Response } from "express";

const authenticatedRequest = {
  auth: { userId: "user-from-session", sessionId: "session-1", expiresAt: new Date(Date.now() + 60_000) },
  header(name: string) { return name.toLowerCase() === "x-user-id" ? "attacker-controlled-user" : undefined; },
} as unknown as Request;
assert.equal(authenticatedUserId(authenticatedRequest), "user-from-session", "user identity must come from the verified session");
assert.throws(() => authenticatedUserId({ header: () => "attacker-controlled-user" } as unknown as Request), /Authentication required/);

const allowedOrigins = new Set(["https://avhisafe.netlify.app"]);
const middleware = trustedOriginMiddleware(allowedOrigins);
let nextCalls = 0;
const next = () => { nextCalls += 1; };
const rejectedResponse = {
  status(code: number) { assert.equal(code, 403); return this; },
  json(body: unknown) { assert.deepEqual(body, { error: "Request origin is not allowed." }); return this; },
} as unknown as Response;
middleware({ method: "POST", get: (name: string) => name === "origin" ? "https://evil.example" : undefined } as unknown as Request, rejectedResponse, next);
assert.equal(nextCalls, 0, "cross-site state-changing requests must be rejected");
middleware({ method: "POST", get: (name: string) => name === "origin" ? "https://avhisafe.netlify.app" : undefined } as unknown as Request, {} as Response, next);
assert.equal(nextCalls, 1, "configured application origins must be accepted");
middleware({ method: "GET", get: () => "https://evil.example" } as unknown as Request, {} as Response, next);
assert.equal(nextCalls, 2, "read-only requests do not require an Origin header");

console.log("AvhiSafe request-security tests passed.");
