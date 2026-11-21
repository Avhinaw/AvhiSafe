export type SecurityScanStatus = "queued" | "running" | "completed" | "partial" | "failed";

export interface SecurityScanDocument {
  _id: string;
  userId: string;
  walletId?: string;
  networkId?: string;
  status: SecurityScanStatus;
  scanType: "baseline" | "transactions" | "approvals" | "assets" | "full";
  checksRun: number;
  alertsCreated: number;
  source?: string;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}
