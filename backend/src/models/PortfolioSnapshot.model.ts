export type DataQuality = "complete" | "partial" | "stale" | "unavailable" | "error";

export interface PortfolioSnapshotDocument {
  _id: string;
  userId: string;
  walletId: string;
  networkId: string;
  assetId: string;
  quantity: string;
  price?: number;
  value?: number;
  currency: string;
  source: string;
  dataQuality: DataQuality;
  observedAt: Date;
  fetchedAt: Date;
  expiresAt?: Date;
  rawSourceId?: string;
  payload?: Record<string, unknown>;
}
