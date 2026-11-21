export type AIEditStatus = "planned" | "approved" | "applied" | "rejected" | "failed";

export interface AIEditHistoryDocument {
  _id: string;
  userId: string;
  dashboardId: string;
  prompt: string;
  model?: string;
  provider?: string;
  inputVersion?: number;
  outputSummary?: string;
  operations: Record<string, unknown>[];
  status: AIEditStatus;
  warnings?: string[];
  requiresConfirmation: boolean;
  appliedVersion?: number;
  errorCode?: string;
  createdAt: Date;
  completedAt?: Date;
}
