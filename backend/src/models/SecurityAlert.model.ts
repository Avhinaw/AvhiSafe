export type SecurityAlertSeverity = "low" | "medium" | "high" | "critical";
export type SecurityAlertStatus = "open" | "acknowledged" | "resolved" | "dismissed";

export interface SecurityEvidence {
  type: string;
  description: string;
  source?: string;
  reference?: string;
  observedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface SecurityAlertDocument {
  _id: string;
  userId: string;
  walletId?: string;
  networkId?: string;
  category: string;
  severity: SecurityAlertSeverity;
  title: string;
  explanation: string;
  evidence: SecurityEvidence[];
  source: string;
  confidence?: number;
  status: SecurityAlertStatus;
  detectedAt: Date;
  updatedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}
