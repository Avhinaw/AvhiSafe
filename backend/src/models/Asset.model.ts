export type AssetType = "native" | "token" | "nft" | "unknown";

export interface AssetDocument {
  _id: string;
  networkId: string;
  chainFamily: "ethereum" | "solana";
  assetType: AssetType;
  contractAddress?: string;
  mintAddress?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logoUrl?: string;
  metadataSource?: string;
  verified: boolean;
  isSpam?: boolean;
  metadataUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
