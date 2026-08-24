export type Theme = "light" | "dark" | "system";
export type Density = "comfortable" | "compact" | "analytics";
export type Chain = "ethereum" | "solana";
export type WidgetWidth = "small" | "medium" | "large" | "full";
export type RevisionSource = "manual" | "ai" | "system";
export type AIRequestStatus = "planned" | "approved" | "applied" | "rejected" | "failed";

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}
