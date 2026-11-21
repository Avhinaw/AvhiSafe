export interface AIUsageDocument {
  _id: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  requestCount: number;
  successfulRequestCount: number;
  failedRequestCount: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  currency?: string;
  model?: string;
  updatedAt: Date;
}
