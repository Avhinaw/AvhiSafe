import { backendUrl, notifySessionExpired } from "./authApi";

export type WidgetDefinition = {
  _id: string;
  type: string;
  version: number;
  name: string;
  description: string;
  category: string;
  lifecycle: "active" | "beta" | "deprecated";
  rendererKey: string;
};

export type NetworkDefinition = {
  _id: string;
  key: string;
  chainFamily: "ethereum" | "solana";
  chainId?: string;
  name: string;
  shortName?: string;
  environment: "mainnet" | "testnet" | "devnet";
  enabled: boolean;
  capabilities: string[];
};

export type DashboardTemplate = {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  isSystem: boolean;
  widgets: Array<{ id: string; type: string; title?: string; enabled: boolean; position: number; width: "small" | "medium" | "large" | "full"; config: Record<string, unknown> }>;
};

export type DashboardPreference = {
  _id: string;
  dashboardId: string;
  currency?: string;
  timezone?: string;
  refreshIntervalSeconds?: number;
  autoSave?: boolean;
  showArchivedWidgets?: boolean;
  defaultWalletIds?: string[];
  defaultNetworkIds?: string[];
  displayOptions?: Record<string, unknown>;
};

export type UserNotification = {
  _id: string;
  type: "security" | "sync" | "system" | "portfolio";
  status: "unread" | "read" | "archived";
  title: string;
  body: string;
  severity?: "info" | "success" | "warning" | "error";
  resourceType?: string;
  resourceId?: string;
  createdAt: string;
};

export type SecurityAlert = {
  _id: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  explanation: string;
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  detectedAt: string;
};

export type SecurityCheck = {
  _id: string;
  result: "pass" | "warn" | "fail" | "unknown" | "not_supported";
  title: string;
  explanation: string;
  checkedAt: string;
};

export type SecurityScan = {
  _id: string;
  status: "queued" | "running" | "completed" | "partial" | "failed";
  scanType: "baseline" | "transactions" | "approvals" | "assets" | "full";
  checksRun: number;
  alertsCreated: number;
  createdAt: string;
};

export type ActivityData = {
  snapshots: Array<{ _id: string; value?: number; currency: string; dataQuality: string; observedAt: string }>;
  transactions: Array<{ _id: string; txHash: string; status: string; direction: string; timestamp: string; source: string }>;
  walletSyncs: Array<{ _id: string; status: string; recordsFetched?: number; completedAt?: string; errorMessage?: string }>;
  transactionSyncs: Array<{ _id: string; status: string; recordsFetched?: number; completedAt?: string; errorMessage?: string }>;
  tokenBalances: Array<{ _id: string; assetId: string; quantity: string; value?: number; currency?: string; dataQuality: string; fetchedAt: string }>;
  assets: Array<{ _id: string; symbol?: string; name?: string; assetType: string; verified: boolean }>;
  assetPrices: Array<{ _id: string; assetId: string; currency: string; price: number; observedAt: string }>;
};

export type AiUsage = {
  _id: string;
  periodStart: string;
  periodEnd: string;
  requestCount: number;
  successfulRequestCount: number;
  failedRequestCount: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  model?: string;
};

export type AiEdit = {
  _id: string;
  prompt: string;
  outputSummary?: string;
  status: string;
  model?: string;
  warnings?: string[];
  createdAt: string;
};

export type UserPreferences = {
  currency: string;
  timezone?: string;
  locale?: string;
  theme?: "light" | "dark" | "system";
  notifications?: Record<string, boolean>;
};

export type UserSession = {
  _id: string;
  status: "active" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  deviceLabel?: string;
  isCurrent: boolean;
};

export type AuditEntry = {
  _id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  result: "success" | "failure" | "denied";
  createdAt: string;
};

export type FeaturePermission = {
  featureKey: string;
  enabled: boolean;
  config: Record<string, unknown>;
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

export function loadModelCatalog() {
  return request<{ widgets: WidgetDefinition[]; networks: NetworkDefinition[]; templates: DashboardTemplate[] }>("/api/v1/catalog");
}

export function loadDashboardPreference(dashboardId: string) {
  return request<{ preference: DashboardPreference | null }>(`/api/v1/dashboards/${encodeURIComponent(dashboardId)}/preferences`);
}

export function saveDashboardPreference(dashboardId: string, input: Partial<DashboardPreference>) {
  return request<{ preference: DashboardPreference }>(`/api/v1/dashboards/${encodeURIComponent(dashboardId)}/preferences`, { method: "PUT", body: JSON.stringify(input) });
}

export function saveDashboardTemplate(input: { dashboardId: string; name: string; description?: string; category?: "portfolio" | "security" | "research" | "defi" | "custom" }) {
  return request<{ template: DashboardTemplate }>("/api/v1/dashboard-templates", { method: "POST", body: JSON.stringify(input) });
}

export function applyDashboardTemplate(templateId: string, dashboardId: string) {
  return request<{ dashboard: import("./dashboardApi").Dashboard; uiDocument: import("./dashboardApi").UIDocument }>(`/api/v1/dashboard-templates/${encodeURIComponent(templateId)}/apply`, { method: "POST", body: JSON.stringify({ dashboardId }) });
}

export function listNotifications() {
  return request<{ notifications: UserNotification[] }>("/api/v1/notifications");
}

export function updateNotification(notificationId: string, status: "read" | "archived") {
  return request<{ notification: UserNotification }>(`/api/v1/notifications/${encodeURIComponent(notificationId)}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function markAllNotificationsRead() {
  return request<{ updatedCount: number }>("/api/v1/notifications/read-all", { method: "POST" });
}

export function loadSecurityData() {
  return request<{ scans: SecurityScan[]; alerts: SecurityAlert[]; checks: SecurityCheck[]; coverage: string }>("/api/v1/security/scans");
}

export function runBaselineScan() {
  return request<{ scan: SecurityScan; checks: SecurityCheck[]; alerts: SecurityAlert[]; coverage: string }>("/api/v1/security/scans", { method: "POST", body: JSON.stringify({ scanType: "baseline" }) });
}

export function updateSecurityAlert(alertId: string, status: "acknowledged" | "resolved" | "dismissed") {
  return request<{ alert: SecurityAlert }>(`/api/v1/security/alerts/${encodeURIComponent(alertId)}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function loadActivity() {
  return request<ActivityData>("/api/v1/activity");
}

export function loadAiUsage() {
  return request<{ usage: AiUsage[]; edits: AiEdit[] }>("/api/v1/ai/usage");
}

export function loadIntegrationRecords() {
  return request<{ integrations: Array<{ _id: string; type: string; provider: string; status: string; scopes: string[] }>; supportedAdapters: string[]; message: string }>("/api/v1/integrations");
}

export function loadUserPreferences() {
  return request<{ preferences: UserPreferences }>("/api/v1/profile/preferences");
}

export function saveUserPreferences(preferences: Partial<UserPreferences>) {
  return request<{ preferences: UserPreferences }>("/api/v1/profile/preferences", { method: "PUT", body: JSON.stringify(preferences) });
}

export function loadSessions() {
  return request<{ sessions: UserSession[] }>("/api/v1/sessions");
}

export function revokeSession(sessionId: string) {
  return request<void>(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: "POST" });
}

export function loadAuditLog() {
  return request<{ logs: AuditEntry[] }>("/api/v1/audit-logs");
}

export function updateFeaturePermission(featureKey: string, enabled: boolean, config: Record<string, unknown> = {}) {
  return request<{ permission: { featureKey: string; enabled: boolean; config: Record<string, unknown> } }>(`/api/v1/permissions/${encodeURIComponent(featureKey)}`, {
    method: "PUT",
    body: JSON.stringify({ enabled, config }),
  });
}

export function loadFeaturePermissions() {
  return request<{ permissions: FeaturePermission[] }>("/api/v1/permissions");
}
