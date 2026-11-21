import type { Timestamps } from "./base.js";

export type ChainFamily = "ethereum" | "solana";
export type WalletSourceType = "connected" | "watch_only" | "exchange_read_only";
export type WalletStatus = "active" | "hidden" | "archived" | "disconnected" | "removed";

export interface WalletDocument extends Timestamps {
  _id: string;
  userId: string;
  chainFamily: ChainFamily;
  address: string;
  normalizedAddress: string;
  label?: string;
  sourceType: WalletSourceType;
  supportedNetworks: string[];
  status: WalletStatus;
  provider?: string;
  connectionId?: string;
  lastSyncedAt?: Date;
  createdBy?: "user" | "system" | "import";
}

/** Legacy connected-wallet shape retained for existing API code. */
export interface ConnectedWalletDocument extends Timestamps {
  _id: string;
  userId: string;
  chain: ChainFamily;
  address: string;
  provider: string;
  label?: string;
  chainId?: string;
  lastSeenAt: Date;
}

export interface PublicAddressDocument extends Timestamps {
  _id: string;
  userId: string;
  chain: ChainFamily;
  address: string;
  normalizedAddress?: string;
  label?: string;
  notes?: string;
  source: "watch" | "generated" | "connected";
  networkIds?: string[];
}
