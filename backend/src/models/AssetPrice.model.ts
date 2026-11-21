export interface AssetPriceDocument {
  _id: string;
  assetId: string;
  currency: string;
  price: number;
  source: string;
  observedAt: Date;
  fetchedAt: Date;
  confidence?: "high" | "medium" | "low";
  isEstimated?: boolean;
}
