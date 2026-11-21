export type SessionStatus = "active" | "revoked" | "expired";

export interface SessionDocument {
  _id: string;
  userId: string;
  tokenHash: string;
  status: SessionStatus;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  revokeReason?: string;
  ipHash?: string;
  userAgentHash?: string;
  deviceLabel?: string;
}
