import type { UISpec } from "../uiSchema.js";
import type { Timestamps } from "./base.js";

export interface UIDocument extends Timestamps {
  _id: string;
  userId: string;
  dashboardId: string;
  version: number;
  source: "ai" | "system";
  prompt?: string;
  spec: UISpec;
}

export interface UIRevisionDocument {
  _id: string;
  userId: string;
  dashboardId: string;
  source: "ai" | "system";
  prompt?: string;
  summary: string;
  spec: UISpec;
  createdAt: Date;
}
