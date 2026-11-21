import { backendUrl, notifySessionExpired } from "./authApi";
import type { EncryptedVault } from "./vault";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  if (response.status === 401) notifySessionExpired();
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error || `Vault request failed (${response.status}).`); }
  return response.json() as Promise<T>;
}
export function saveRemoteVault(vault: EncryptedVault) { return request<{ saved: boolean; updatedAt: string }>("/api/v1/vault", { method: "PUT", body: JSON.stringify(vault) }); }
export function loadRemoteVault() { return request<{ vault: (EncryptedVault & { updatedAt: string }) | null }>("/api/v1/vault"); }
