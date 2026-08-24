import type { AIRequestStatus } from "./base.js";

export interface AIRequestDocument {
  _id: string;
  userId: string;
  dashboardId?: string;
  prompt: string;
  intent?: string;
  status: AIRequestStatus;
  response?: Record<string, unknown>;
  completedAt?: Date;
}

export interface FeaturePermissionDocument {
  _id: string;
  userId: string;
  featureKey: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updatedAt: Date;
}
