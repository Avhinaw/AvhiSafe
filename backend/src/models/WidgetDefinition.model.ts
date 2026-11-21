export type WidgetLifecycle = "active" | "beta" | "deprecated";

export interface WidgetDefinitionDocument {
  _id: string;
  type: string;
  version: number;
  name: string;
  description: string;
  category: "portfolio" | "wallet" | "transactions" | "security" | "network" | "defi" | "nft";
  lifecycle: WidgetLifecycle;
  settingsSchema: Record<string, unknown>;
  dataContract: Record<string, unknown>;
  permissions: string[];
  supportedChainFamilies?: ("ethereum" | "solana")[];
  rendererKey: string;
  createdAt: Date;
  updatedAt: Date;
}
