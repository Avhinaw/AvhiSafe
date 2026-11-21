import type { Timestamps } from "./base.js";

export interface DashboardPreferenceDocument extends Timestamps {
  _id: string;
  userId: string;
  dashboardId: string;
  currency?: string;
  timezone?: string;
  refreshIntervalSeconds?: number;
  autoSave?: boolean;
  showArchivedWidgets?: boolean;
  defaultWalletIds?: string[];
  defaultNetworkIds?: string[];
  displayOptions?: Record<string, unknown>;
}
