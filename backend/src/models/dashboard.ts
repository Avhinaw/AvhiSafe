import type { Density, Theme, Timestamps, WidgetWidth } from "./base.js";

export interface UserDocument extends Timestamps {
  _id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: "user" | "admin";
}

export interface DashboardWidget {
  id: string;
  type: string;
  title?: string;
  enabled: boolean;
  position: number;
  width: WidgetWidth;
  config: Record<string, unknown>;
}

export type DashboardSnapshot = Pick<DashboardDocument, "name" | "theme" | "currency" | "density" | "widgets" | "filters">;

export interface DashboardDocument extends Timestamps {
  _id: string;
  userId: string;
  slug: string;
  name: string;
  theme: Theme;
  currency: string;
  density: Density;
  isDefault: boolean;
  widgets: DashboardWidget[];
  filters: Record<string, unknown>;
}

export interface DashboardRevisionDocument {
  _id: string;
  userId: string;
  dashboardId: string;
  source: import("./base.js").RevisionSource;
  prompt?: string;
  summary: string;
  snapshot: DashboardSnapshot;
  createdAt: Date;
}
