export type AuthNonceStatus = "issued" | "used" | "expired" | "revoked";

export interface AuthNonceDocument {
  _id: string;
  nonce: string;
  message: string;
  domain: string;
  chainFamily: "ethereum" | "solana";
  address: string;
  normalizedAddress: string;
  statement?: string;
  issuedAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  status: AuthNonceStatus;
  requestIpHash?: string;
  userAgentHash?: string;
}
