import type { Chain } from "./base.js";

export interface PortfolioSnapshotDocument {
  _id: string;
  userId: string;
  chain: Chain;
  address: string;
  totalValueUsd: number;
  payload: Record<string, unknown>;
  capturedAt: Date;
}
