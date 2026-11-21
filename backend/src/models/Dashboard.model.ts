import type { Density, Theme, Timestamps, WidgetWidth } from "./base.js";

export type DashboardLayoutMode = "stack" | "grid" | "masonry";
export type DashboardVisibility = "private" | "shared";

export interface DashboardWidget {
  id: string;
  type: string;
  widgetSchemaVersion?: number;
  title?: string;
  enabled: boolean;
  position: number;
  width: WidgetWidth;
  config: Record<string, unknown>;
  dataScope?: { walletIds?: string[]; networkIds?: string[] };
  layout?: { x: number; y: number; w: number; h: number };
  visibility?: "visible" | "hidden";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DashboardDocument extends Timestamps {
  _id: string;
  userId: string;
  slug: string;
  name: string;
  description?: string;
  schemaVersion?: number;
  layoutMode?: DashboardLayoutMode;
  theme: Theme;
  currency: string;
  density: Density;
  isDefault: boolean;
  visibility?: DashboardVisibility;
  version?: number;
  widgets: DashboardWidget[];
  filters: Record<string, unknown>;
  archivedAt?: Date;
  templateId?: string;
}

export type DashboardSnapshot = Pick<DashboardDocument, "name" | "theme" | "currency" | "density" | "widgets" | "filters"> & Partial<Pick<DashboardDocument, "description" | "schemaVersion" | "layoutMode" | "version">>;
