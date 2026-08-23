export type DashboardWidget = { id: string; type: string; title?: string; enabled: boolean; position: number; width: "small" | "medium" | "large" | "full"; config: Record<string, unknown> };
export type Dashboard = { _id: string; userId: string; name: string; slug: string; theme: "light" | "dark" | "system"; currency: string; density: "comfortable" | "compact" | "analytics"; isDefault: boolean; widgets: DashboardWidget[]; filters: Record<string, unknown> };
export type DashboardPlan = { intent: "customize_dashboard" | "unsupported"; explanation: string; operations: Array<Record<string, unknown>>; warnings: string[]; requiresApproval: boolean };

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://avhisafe-backend.onrender.com").replace(/\/$/, "");

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
  const response = await fetch(`${backendUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", "x-user-id": getDashboardUserId(), ...(options.headers || {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error || `Backend request failed (${response.status}).`);
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export function loadWorkspace() { return request<{ dashboard: Dashboard; dashboards: Dashboard[]; revisions: unknown[]; addresses: unknown[]; wallets: unknown[]; permissions: unknown[] }>("/api/v1/workspace"); }
export function createDashboard(input: Omit<Dashboard, "_id" | "userId">) { return request<{ dashboard: Dashboard }>("/api/v1/dashboards", { method: "POST", body: JSON.stringify(input) }); }
export function updateDashboard(id: string, input: Partial<Dashboard> & { revisionSummary?: string }) { return request<{ dashboard: Dashboard }>(`/api/v1/dashboards/${id}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function planDashboard(id: string, prompt: string) { return request<{ plan: DashboardPlan; request: unknown }>("/api/v1/ai/plan", { method: "POST", body: JSON.stringify({ dashboardId: id, prompt }) }); }
export function applyDashboardPlan(id: string, prompt: string, plan: DashboardPlan) {
  return request<{ dashboard: Dashboard; plan: DashboardPlan }>("/api/v1/ai/apply", {
    method: "POST",
    body: JSON.stringify({ dashboardId: id, prompt, plan }),
  });
}
export function undoDashboard(id: string) { return request<{ dashboard: Dashboard }>(`/api/v1/dashboards/${id}/undo`, { method: "POST" }); }
export function deleteDashboard(id: string) { return request<void>(`/api/v1/dashboards/${id}`, { method: "DELETE" }); }
