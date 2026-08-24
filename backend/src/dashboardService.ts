import { randomUUID } from "node:crypto";
import type { DashboardDocument, DashboardRevisionDocument } from "./models/index.js";
import type { DashboardOperation } from "./widgetCatalog.js";
import { createDashboardRevision } from "./db.js";

export function applyOperations(dashboard: DashboardDocument, operations: DashboardOperation[], now = new Date()): DashboardDocument {
  const next: DashboardDocument = structuredClone(dashboard);
  for (const operation of operations) {
    if (operation.type === "set_theme") next.theme = operation.value;
    if (operation.type === "set_currency") next.currency = operation.value;
    if (operation.type === "set_density") next.density = operation.value;
    if (operation.type === "set_filter") next.filters[operation.key] = operation.value;
    if (operation.type === "enable_widget") {
      const existing = next.widgets.find((widget) => widget.type === operation.widgetType);
      if (existing) { existing.enabled = true; if (operation.width) existing.width = operation.width; }
      else next.widgets.push({ id: `${operation.widgetType}-${randomUUID()}`, type: operation.widgetType, title: operation.title, enabled: true, position: next.widgets.length, width: operation.width || "medium", config: {} });
    }
    if (operation.type === "disable_widget") { const existing = next.widgets.find((widget) => widget.type === operation.widgetType); if (existing) existing.enabled = false; }
    if (operation.type === "move_widget") { const existing = next.widgets.find((widget) => widget.type === operation.widgetType); if (existing) existing.position = operation.position; }
    if (operation.type === "resize_widget") { const existing = next.widgets.find((widget) => widget.type === operation.widgetType); if (existing) existing.width = operation.width; }
  }
  next.widgets.sort((a, b) => a.position - b.position).forEach((widget, index) => { widget.position = index; });
  next.updatedAt = now;
  return next;
}

export async function revisionFor(dashboard: DashboardDocument, userId: string, source: DashboardRevisionDocument["source"], summary: string, prompt?: string, now = new Date()): Promise<DashboardRevisionDocument> {
  const revision: DashboardRevisionDocument = { _id: randomUUID(), userId, dashboardId: dashboard._id, source, prompt, summary, snapshot: { name: dashboard.name, theme: dashboard.theme, currency: dashboard.currency, density: dashboard.density, widgets: dashboard.widgets, filters: dashboard.filters }, createdAt: now };
  await createDashboardRevision(revision);
  return revision;
}
