export interface TokenBalanceDocument {
  _id: string;
  userId: string;
  walletId: string;
  networkId: string;
  assetId: string;
  quantity: string;
  decimals: number;
  formattedQuantity?: string;
  price?: number;
  value?: number;
  currency?: string;
  source: string;
  fetchedAt: Date;
  dataQuality: "complete" | "partial" | "stale" | "unavailable" | "error";
}
