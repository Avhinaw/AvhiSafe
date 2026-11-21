export type AuthChain = "ethereum" | "solana";

export type AuthUser = {
  _id: string;
  primaryWalletAddress?: string;
  primaryWalletChain?: AuthChain;
  authMethods: Array<{ type: string; identifier: string; verifiedAt?: string; provider?: string }>;
  preferences: { currency: string; theme?: "light" | "dark" | "system"; timezone?: string; locale?: string };
  status: "active" | "suspended" | "deleting" | "deleted";
  role?: "user" | "admin";
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

export type SessionInfo = { id: string; expiresAt: string };
export type WalletAuthResult = { user: AuthUser; session: SessionInfo; address: string; chainFamily: AuthChain; chainId?: string };

export const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://avhisafe-backend.onrender.com";

export function notifySessionExpired() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("avhisafe:session-expired"));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (response.status === 401) notifySessionExpired();
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export function issueAuthNonce(input: { chainFamily: AuthChain; address: string; chainId?: string }) {
  return request<{ nonceId: string; nonce: string; message: string; issuedAt: string; expiresAt: string; domain: string; chainFamily: AuthChain; address: string }>("/api/v1/auth/nonce", { method: "POST", body: JSON.stringify(input) });
}

export function verifyAuthNonce(input: { nonceId: string; address: string; signature: string; message: string }) {
  return request<{ user: AuthUser; session: SessionInfo }>("/api/v1/auth/verify", { method: "POST", body: JSON.stringify(input) });
}

export function loadCurrentUser() {
  return request<{ user: AuthUser; session: SessionInfo }>("/api/v1/auth/me");
}

export function logoutApi() {
  return request<void>("/api/v1/auth/logout", { method: "POST" });
}
