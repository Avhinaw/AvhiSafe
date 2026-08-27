export type Dashboard = { _id: string; userId: string; name: string; slug: string; theme: "light" | "dark" | "system"; currency: string; density: "comfortable" | "compact" | "analytics"; isDefault: boolean; widgets: DashboardWidget[]; filters: Record<string, unknown> };
export type DashboardWidget = { id: string; type: string; title?: string; enabled: boolean; position: number; width: "small" | "medium" | "large" | "full"; config: Record<string, unknown> };
export type UIComponent =
  | { type: "widget"; id: string; widgetType: string; title?: string; width: DashboardWidget["width"] }
  | { type: "text"; id: string; text: string; emphasis: "normal" | "muted" | "strong" }
  | { type: "metric"; id: string; label: string; source: "portfolio-value" | "native-balances" | "security-score" | "wallet-count"; format: "number" | "currency" | "percent" }
  | { type: "card"; id: string; title?: string; tone: "neutral" | "accent" | "success" | "warning" | "info" | "danger"; text?: string; body?: string; content?: string; description?: string; severity?: "low" | "medium" | "high"; width?: DashboardWidget["width"] }
  | { type: "badge"; id: string; label: string; tone: "neutral" | "accent" | "success" | "warning" | "info" | "danger" }
  | { type: "list"; id: string; title?: string; items: string[]; tone: "neutral" | "accent" | "success" | "warning" | "info" | "danger" }
  | { type: "divider"; id: string; label?: string };
export type UISpec = { version: 1; title: string; description: string; accentPreset: "cyan" | "violet" | "emerald" | "amber" | "rose" | "slate"; theme: { mode: "light" | "dark" | "system"; surface: "flat" | "soft" | "glass"; radius: "sharp" | "rounded" | "pill"; typography: "neutral" | "technical" | "editorial"; density: "comfortable" | "compact" }; layout: "stack" | "grid"; columns: number; components: UIComponent[] };
export type UIDocument = { _id: string; userId: string; dashboardId: string; version: number; source: "ai" | "system"; prompt?: string; spec: UISpec; createdAt: string; updatedAt: string };
export type DashboardPlan = { intent: "customize_ui" | "unsupported"; explanation: string; warnings: string[]; requiresApproval: boolean; ui: UISpec | null; source: "ai"; model?: string; requestId?: string };
export type AiStatus = { configured: boolean; mode: "ai" | "unconfigured"; model: string };

const configuredBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim().replace(/\/$/, "");
const backendUrl = configuredBackendUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredBackendUrl) ? configuredBackendUrl : "https://avhisafe-backend.onrender.com";

export function getDashboardUserId() {
  if (typeof window === "undefined") return "browser-preview";
  const key = "avhisafe.dashboard.userId";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = `browser-${crypto.randomUUID()}`;
  localStorage.setItem(key, id);
  return id;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${backendUrl}${path}`, { ...options, signal: options.signal || controller.signal, headers: { "Content-Type": "application/json", "x-user-id": getDashboardUserId(), ...(options.headers || {}) } });
    if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error || `Backend request failed (${response.status}).`);
    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The AvhiSafe backend took too long to respond. Please retry.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function loadWorkspace() { return request<{ dashboard: Dashboard; uiDocument: UIDocument; dashboards: Dashboard[]; revisions: unknown[]; uiRevisions: unknown[]; addresses: unknown[]; wallets: unknown[]; permissions: unknown[] }>("/api/v1/workspace"); }
export function getAiStatus() { return request<AiStatus>("/api/v1/ai/status"); }
export function createDashboard(input: Omit<Dashboard, "_id" | "userId">) { return request<{ dashboard: Dashboard; uiDocument: UIDocument }>("/api/v1/dashboards", { method: "POST", body: JSON.stringify(input) }); }
export function updateDashboard(id: string, input: Partial<Dashboard> & { revisionSummary?: string }) { return request<{ dashboard: Dashboard }>(`/api/v1/dashboards/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function planDashboard(id: string, prompt: string) { return request<{ plan: DashboardPlan; request: unknown }>("/api/v1/ai/plan", { method: "POST", body: JSON.stringify({ dashboardId: id, prompt }) }); }
export function applyDashboardPlan(id: string, prompt: string, plan: DashboardPlan) { return request<{ dashboard: Dashboard; uiDocument: UIDocument; plan: DashboardPlan }>("/api/v1/ai/apply", { method: "POST", body: JSON.stringify({ dashboardId: id, prompt, plan }) }); }
export function undoDashboardUi(id: string) { return request<{ dashboard: Dashboard; uiDocument: UIDocument }>(`/api/v1/dashboards/${id}/ui-undo`, { method: "POST" }); }
export function deleteDashboard(id: string) { return request<void>(`/api/v1/dashboards/${id}`, { method: "DELETE" }); }
