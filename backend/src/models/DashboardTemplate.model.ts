import type { DashboardWidget } from "./Dashboard.model.js";
import type { UISpec } from "../uiSchema.js";

export interface DashboardTemplateDocument {
  _id: string;
  ownerUserId?: string;
  name: string;
  description?: string;
  category?: "portfolio" | "security" | "research" | "defi" | "custom";
  schemaVersion: number;
  theme?: string;
  widgets: DashboardWidget[];
  uiSpec?: UISpec;
  isSystem: boolean;
  isPublished?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
