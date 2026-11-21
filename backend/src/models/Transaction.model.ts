export type TransactionDirection = "in" | "out" | "self" | "unknown";
export type TransactionStatus = "pending" | "confirmed" | "failed" | "dropped" | "unknown";

export interface AssetTransfer {
  assetId: string;
  quantity: string;
  direction: TransactionDirection;
  from?: string;
  to?: string;
  contractAddress?: string;
}

export interface TransactionFee {
  assetId?: string;
  quantity: string;
  value?: number;
  currency?: string;
}

export interface TransactionDocument {
  _id: string;
  userId: string;
  walletId: string;
  networkId: string;
  txHash: string;
  direction: TransactionDirection;
  status: TransactionStatus;
  timestamp: Date;
  assetTransfers: AssetTransfer[];
  fee?: TransactionFee;
  counterparty?: string;
  source: string;
  fetchedAt: Date;
  dataQuality?: "complete" | "partial" | "stale" | "error";
  rawSourceId?: string;
}
