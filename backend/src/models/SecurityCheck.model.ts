export type SecurityCheckResult = "pass" | "warn" | "fail" | "unknown" | "not_supported";

export interface SecurityCheckDocument {
  _id: string;
  scanId: string;
  userId: string;
  walletId?: string;
  networkId?: string;
  checkType: string;
  result: SecurityCheckResult;
  title: string;
  explanation: string;
  evidence: Record<string, unknown>[];
  source?: string;
  confidence?: number;
  checkedAt: Date;
}
