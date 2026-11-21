export type NetworkEnvironment = "mainnet" | "testnet" | "devnet";

export interface BlockchainNetworkDocument {
  _id: string;
  key: string;
  chainFamily: "ethereum" | "solana";
  chainId?: string;
  name: string;
  shortName?: string;
  environment: NetworkEnvironment;
  nativeAssetId?: string;
  rpcProvider?: string;
  explorerUrl?: string;
  enabled: boolean;
  capabilities: string[];
  createdAt: Date;
  updatedAt: Date;
}
