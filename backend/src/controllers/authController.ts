import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { getAddress, verifyMessage } from "ethers";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { z } from "zod";
import { collections } from "../db.js";
import type { AuthNonceDocument, AuthMethod, SessionDocument, UserDocument } from "../models/index.js";

export const nonceInput = z.object({
  chainFamily: z.enum(["ethereum", "solana"]),
  address: z.string().trim().min(20).max(128),
  statement: z.string().trim().max(240).optional(),
  chainId: z.string().trim().max(64).optional(),
}).strict();

export const verifyInput = z.object({
  nonceId: z.string().uuid(),
  address: z.string().trim().min(20).max(128),
  signature: z.string().trim().min(16).max(2048),
  message: z.string().min(1).max(4096),
}).strict();

const SESSION_COOKIE = "avhisafe_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function configuredDomain(request: Request) {
  return process.env.AUTH_DOMAIN || request.get("origin")?.replace(/^https?:\/\//, "").replace(/\/$/, "") || request.hostname;
}

function configuredUri(domain: string) {
  return process.env.AUTH_URI || `https://${domain}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeAddress(chainFamily: "ethereum" | "solana", address: string) {
  if (chainFamily === "ethereum") return getAddress(address).toLowerCase();
  const decoded = bs58.decode(address);
  if (decoded.length !== 32) throw new Error("Invalid Solana address.");
  return bs58.encode(decoded);
}

function displayAddress(chainFamily: "ethereum" | "solana", normalizedAddress: string) {
  return chainFamily === "ethereum" ? getAddress(normalizedAddress) : normalizedAddress;
}

function buildChallengeMessage(input: {
  chainFamily: "ethereum" | "solana";
  domain: string;
  address: string;
  statement: string;
  uri: string;
  chainId: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}) {
  return `${input.domain} wants you to sign in with your ${input.chainFamily === "solana" ? "Solana" : "Ethereum"} account:\n${input.address}\n\n${input.statement}\n\nURI: ${input.uri}\nVersion: 1\nChain ID: ${input.chainId}\nNonce: ${input.nonce}\nIssued At: ${input.issuedAt.toISOString()}\nExpiration Time: ${input.expiresAt.toISOString()}`;
}

function cookieSecure() {
  return process.env.COOKIE_SECURE !== "false";
}

function cookieSameSite() {
  return process.env.COOKIE_SAME_SITE || (cookieSecure() ? "None" : "Lax");
}

export function setSessionCookie(response: Response, token: string) {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`,
    "HttpOnly",
    `SameSite=${cookieSameSite()}`,
  ];
  if (cookieSecure()) attributes.push("Secure");
  response.setHeader("Set-Cookie", attributes.join("; "));
}

export function clearSessionCookie(response: Response) {
  const attributes = [`${SESSION_COOKIE}=`, "Path=/", "Max-Age=0", "HttpOnly", `SameSite=${cookieSameSite()}`];
  if (cookieSecure()) attributes.push("Secure");
  response.setHeader("Set-Cookie", attributes.join("; "));
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

function errorResponse(response: Response, error: unknown, fallback: string, status = 400) {
  return response.status(status).json({ error: error instanceof Error ? error.message : fallback });
}

export async function issueNonce(request: Request, response: Response) {
  try {
    const input = nonceInput.parse(request.body);
    const normalizedAddress = normalizeAddress(input.chainFamily, input.address);
    const address = displayAddress(input.chainFamily, normalizedAddress);
    const domain = configuredDomain(request);
    const configuredRequestDomain = process.env.AUTH_DOMAIN;
    if (configuredRequestDomain && domain !== configuredRequestDomain) return errorResponse(response, new Error("Authentication domain is not allowed."), "Authentication domain is not allowed.", 400);

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
    const nonce = randomBytes(32).toString("hex");
    const chainId = input.chainId || (input.chainFamily === "ethereum" ? "1" : "mainnet-beta");
    const statement = input.statement || "Sign in to AvhiSafe. This request will not trigger a blockchain transaction.";
    const message = buildChallengeMessage({ chainFamily: input.chainFamily, domain, address, statement, uri: configuredUri(domain), chainId, nonce, issuedAt, expiresAt });
    const document: AuthNonceDocument = {
      _id: randomUUID(), nonce, message, domain, chainFamily: input.chainFamily, address, normalizedAddress, statement,
      issuedAt, expiresAt, status: "issued", requestIpHash: request.ip ? sha256(request.ip) : undefined,
      userAgentHash: request.get("user-agent") ? sha256(request.get("user-agent") as string) : undefined,
    };
    await (await collections.authNonces()).insertOne(document);
    return response.status(201).json({ nonceId: document._id, nonce, message, issuedAt, expiresAt, domain, chainFamily: input.chainFamily, address });
  } catch (error) {
    return errorResponse(response, error, "Unable to issue authentication nonce.");
  }
}

async function verifySignature(nonce: AuthNonceDocument, address: string, signature: string, message: string) {
  if (message !== nonce.message) throw new Error("Authentication message does not match the issued challenge.");
  const normalizedAddress = normalizeAddress(nonce.chainFamily, address);
  if (normalizedAddress !== nonce.normalizedAddress) throw new Error("Authentication address does not match the issued challenge.");
  if (nonce.chainFamily === "ethereum") {
    const recovered = getAddress(verifyMessage(message, signature)).toLowerCase();
    if (recovered !== nonce.normalizedAddress) throw new Error("Invalid Ethereum signature.");
  } else {
    let signatureBytes: Uint8Array;
    try { signatureBytes = bs58.decode(signature); } catch { throw new Error("Invalid Solana signature encoding."); }
    const publicKeyBytes = bs58.decode(nonce.normalizedAddress);
    if (signatureBytes.length !== nacl.sign.signatureLength || !nacl.sign.detached.verify(new TextEncoder().encode(message), signatureBytes, publicKeyBytes)) throw new Error("Invalid Solana signature.");
  }
}

async function findOrCreateUser(nonce: AuthNonceDocument) {
  const users = await collections.users();
  const identifier = nonce.normalizedAddress;
  const authMethod: AuthMethod = { type: nonce.chainFamily === "ethereum" ? "evm_wallet" : "solana_wallet", identifier, verifiedAt: new Date(), provider: "wallet_signature" };
  const existing = await users.findOne({ authMethods: { $elemMatch: { type: authMethod.type, identifier } } });
  if (existing) {
    await users.updateOne({ _id: existing._id }, { $set: { lastLoginAt: new Date(), updatedAt: new Date() }, $addToSet: { authMethods: authMethod } } as never);
    return { ...existing, lastLoginAt: new Date() };
  }
  const now = new Date();
  const user: UserDocument = {
    _id: randomUUID(), primaryWalletAddress: identifier, primaryWalletChain: nonce.chainFamily, authMethods: [authMethod],
    preferences: { currency: "USD", theme: "system" }, status: "active", role: "user", createdAt: now, updatedAt: now, lastLoginAt: now,
  };
  await users.insertOne(user);
  return user;
}

export async function verifyNonce(request: Request, response: Response) {
  try {
    const input = verifyInput.parse(request.body);
    const nonces = await collections.authNonces();
    const nonce = await nonces.findOne({ _id: input.nonceId });
    if (!nonce) return errorResponse(response, new Error("Authentication challenge was not found."), "Authentication challenge was not found.", 401);
    const now = new Date();
    if (nonce.status !== "issued" || nonce.expiresAt <= now) {
      if (nonce.status === "issued" && nonce.expiresAt <= now) await nonces.updateOne({ _id: nonce._id, status: "issued" }, { $set: { status: "expired" } });
      return errorResponse(response, new Error("Authentication challenge is expired or already used."), "Authentication challenge is expired or already used.", 401);
    }
    await verifySignature(nonce, input.address, input.signature, input.message);
    const claimed = await nonces.updateOne({ _id: nonce._id, status: "issued", expiresAt: { $gt: now } }, { $set: { status: "used", usedAt: now } });
    if (claimed.modifiedCount !== 1) return errorResponse(response, new Error("Authentication challenge was already used."), "Authentication challenge was already used.", 401);

    const user = await findOrCreateUser(nonce);
    const rawToken = randomBytes(32).toString("base64url");
    const session: SessionDocument = { _id: randomUUID(), userId: user._id, tokenHash: sha256(rawToken), status: "active", createdAt: now, expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_MS), lastUsedAt: now, ipHash: request.ip ? sha256(request.ip) : undefined, userAgentHash: request.get("user-agent") ? sha256(request.get("user-agent") as string) : undefined };
    await (await collections.sessions()).insertOne(session);
    setSessionCookie(response, rawToken);
    return response.json({ user, session: { id: session._id, expiresAt: session.expiresAt } });
  } catch (error) {
    return errorResponse(response, error, "Unable to verify authentication challenge.", 401);
  }
}

export async function logout(request: Request, response: Response) {
  const sessionId = request.auth?.sessionId;
  if (sessionId) await (await collections.sessions()).updateOne({ _id: sessionId, status: "active" }, { $set: { status: "revoked", revokedAt: new Date(), revokeReason: "logout" } });
  clearSessionCookie(response);
  return response.status(204).send();
}

export async function currentUser(request: Request, response: Response) {
  if (!request.auth) return response.status(401).json({ error: "Authentication required." });
  const user = await (await collections.users()).findOne({ _id: request.auth.userId });
  return user ? response.json({ user, session: { id: request.auth.sessionId, expiresAt: request.auth.expiresAt } }) : response.status(401).json({ error: "User not found." });
}

export async function revokeSession(request: Request, response: Response) {
  if (!request.auth) return response.status(401).json({ error: "Authentication required." });
  const updated = await (await collections.sessions()).updateOne({ _id: request.params.sessionId, userId: request.auth.userId, status: "active" }, { $set: { status: "revoked", revokedAt: new Date(), revokeReason: "user_requested" } });
  return updated.matchedCount ? response.status(204).send() : response.status(404).json({ error: "Session not found." });
}
