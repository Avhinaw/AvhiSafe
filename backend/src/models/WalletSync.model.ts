export type SyncStatus = "queued" | "running" | "success" | "partial" | "failed";

export interface WalletSyncDocument {
  _id: string;
  userId: string;
  walletId: string;
  networkId: string;
  status: SyncStatus;
  startedAt?: Date;
  completedAt?: Date;
  nextRunAt?: Date;
  lastSuccessfulAt?: Date;
  cursor?: string;
  recordsFetched?: number;
  errorCode?: string;
  errorMessage?: string;
  provider?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}
