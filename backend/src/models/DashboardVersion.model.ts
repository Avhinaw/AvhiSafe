import type { DashboardSnapshot } from "./Dashboard.model.js";

export type DashboardChangeSource = "manual" | "ai" | "restore" | "template" | "system";

export interface DashboardVersionDocument {
  _id: string;
  dashboardId: string;
  userId: string;
  version: number;
  snapshot: DashboardSnapshot;
  changeSource: DashboardChangeSource;
  changeSummary: string;
  prompt?: string;
  createdAt: Date;
}

/** Compatibility shape used by the current revision service. */
export interface DashboardRevisionDocument extends DashboardVersionDocument {
  source: DashboardChangeSource;
  summary: string;
}
