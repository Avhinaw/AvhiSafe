export type IntegrationType = "exchange_read_only" | "market_data" | "blockchain_provider" | "notification";
export type IntegrationStatus = "active" | "disabled" | "error" | "revoked";

export interface IntegrationDocument {
  _id: string;
  userId: string;
  type: IntegrationType;
  provider: string;
  label?: string;
  status: IntegrationStatus;
  credentialReference?: string;
  scopes: string[];
  lastCheckedAt?: Date;
  errorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}
