import type { Chain, Timestamps } from "./base.js";

export interface ConnectedWalletDocument {
  _id: string;
  userId: string;
  chain: Chain;
  address: string;
  provider: string;
  label?: string;
  chainId?: string;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface PublicAddressDocument extends Timestamps {
  _id: string;
  userId: string;
  chain: Chain;
  address: string;
  label?: string;
  notes?: string;
  source: "watch" | "generated" | "connected";
}
