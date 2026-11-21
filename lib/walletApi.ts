import { backendUrl, notifySessionExpired, type AuthChain } from "./authApi";

export type ServerWallet = {
  _id: string;
  userId: string;
  chainFamily: AuthChain;
  address: string;
  normalizedAddress: string;
  label?: string;
  sourceType: "connected" | "watch_only" | "generated" | "exchange_read_only";
  supportedNetworks: string[];
  status: "active" | "hidden" | "archived" | "disconnected" | "removed";
  provider?: string;
  connectionId?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
};

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

export function listServerWallets() { return request<{ wallets: ServerWallet[] }>("/api/v1/wallets"); }

export function saveConnectedWallet(input: { chainFamily: AuthChain; address: string; supportedNetworks: string[]; provider: string; connectionId?: string; label?: string }) {
  return request<{ wallet: ServerWallet }>("/api/v1/wallets/connected", { method: "POST", body: JSON.stringify(input) });
}

export function saveWatchOnlyWallet(input: { chainFamily: AuthChain; address: string; supportedNetworks: string[]; label?: string }) {
  return request<{ wallet: ServerWallet }>("/api/v1/wallets/watch-only", { method: "POST", body: JSON.stringify(input) });
}

export function saveGeneratedWallet(input: { chainFamily: AuthChain; address: string; supportedNetworks: string[]; label?: string }) {
  return request<{ wallet: ServerWallet }>("/api/v1/wallets/generated", { method: "POST", body: JSON.stringify(input) });
}

export function updateServerWallet(walletId: string, input: { label?: string | null; status?: ServerWallet["status"]; supportedNetworks?: string[] }) {
  return request<{ wallet: ServerWallet }>(`/api/v1/wallets/${walletId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function removeServerWallet(walletId: string) {
  return request<void>(`/api/v1/wallets/${walletId}`, { method: "DELETE" });
}
