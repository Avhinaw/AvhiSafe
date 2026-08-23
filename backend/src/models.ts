export type Theme = "light" | "dark" | "system";
export type Density = "comfortable" | "compact" | "analytics";
export type Chain = "ethereum" | "solana";
export type WidgetWidth = "small" | "medium" | "large" | "full";
export type RevisionSource = "manual" | "ai" | "system";
export type AIRequestStatus = "planned" | "approved" | "applied" | "rejected" | "failed";

export interface UserDocument {
  _id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
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

export interface DashboardDocument {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardRevisionDocument {
  _id: string;
  userId: string;
  dashboardId: string;
  source: RevisionSource;
  prompt?: string;
  summary: string;
  snapshot: Pick<DashboardDocument, "name" | "theme" | "currency" | "density" | "widgets" | "filters">;
  createdAt: Date;
}

export interface AIRequestDocument {
  _id: string;
  userId: string;
  dashboardId?: string;
  prompt: string;
  intent?: string;
  status: AIRequestStatus;
  response?: Record<string, unknown>;
  createdAt: Date;
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

export interface ConnectedWalletDocument {
  _id: string;
  userId: string;
  chain: Chain;
  address: string;
  provider: string;
  label?: string;
  chainId?: string;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface PublicAddressDocument {
  _id: string;
  userId: string;
  chain: Chain;
  address: string;
  label?: string;
  notes?: string;
  source: "watch" | "generated" | "connected";
  createdAt: Date;
  updatedAt: Date;
}

export interface PortfolioSnapshotDocument {
  _id: string;
  userId: string;
  chain: Chain;
  address: string;
  totalValueUsd: number;
  payload: Record<string, unknown>;
  capturedAt: Date;
}
