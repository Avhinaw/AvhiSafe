import { randomUUID } from "node:crypto";
import type { DashboardDocument, DashboardRevisionDocument } from "./models/index.js";
import type { DashboardOperation } from "./widgetCatalog.js";
import { createDashboardRevision } from "./db.js";

export function applyOperations(dashboard: DashboardDocument, operations: DashboardOperation[], now = new Date()): DashboardDocument {
  const next: DashboardDocument = structuredClone(dashboard);
  for (const operation of operations) {
    if (operation.type === "set_dashboard_name") next.name = operation.value;
    if (operation.type === "set_theme") next.theme = operation.value;
    if (operation.type === "set_density") next.density = operation.value;
    if (operation.type === "enable_widget") {
      const existing = next.widgets.find((widget) => widget.type === operation.widgetType);
      if (existing) {
        existing.enabled = true;
        if (operation.title) existing.title = operation.title;
        if (operation.width) existing.width = operation.width;
      } else if (next.widgets.length < 20) {
        next.widgets.push({ id: `${operation.widgetType}-${randomUUID()}`, type: operation.widgetType, title: operation.title, enabled: true, position: next.widgets.length, width: operation.width || "medium", config: {} });
      }
    }
    if (operation.type === "disable_widget") { const existing = next.widgets.find((widget) => widget.type === operation.widgetType); if (existing) existing.enabled = false; }
    if (operation.type === "move_widget") {
      const currentIndex = next.widgets.findIndex((widget) => widget.type === operation.widgetType);
      if (currentIndex >= 0) {
        const [widget] = next.widgets.splice(currentIndex, 1);
        next.widgets.splice(Math.min(operation.position, next.widgets.length), 0, widget);
        next.widgets.forEach((item, index) => { item.position = index; });
      }
    }
    if (operation.type === "resize_widget") { const existing = next.widgets.find((widget) => widget.type === operation.widgetType); if (existing) existing.width = operation.width; }
    if (operation.type === "rename_widget") { const existing = next.widgets.find((widget) => widget.type === operation.widgetType); if (existing) existing.title = operation.title; }
  }
  next.widgets.sort((a, b) => a.position - b.position).forEach((widget, index) => { widget.position = index; });
  next.updatedAt = now;
  return next;
}

export async function revisionFor(dashboard: DashboardDocument, userId: string, source: DashboardRevisionDocument["source"], summary: string, prompt?: string, now = new Date()): Promise<DashboardRevisionDocument> {
  const revision: DashboardRevisionDocument = { _id: randomUUID(), userId, dashboardId: dashboard._id, version: dashboard.version ?? 1, source, changeSource: source, prompt, summary, changeSummary: summary, snapshot: { name: dashboard.name, theme: dashboard.theme, currency: dashboard.currency, density: dashboard.density, widgets: dashboard.widgets, filters: dashboard.filters }, createdAt: now };
  await createDashboardRevision(revision);
  return revision;
}
