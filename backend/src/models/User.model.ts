import type { Timestamps } from "./base.js";

export type UserStatus = "active" | "suspended" | "deleting" | "deleted";
export type AuthMethodType = "evm_wallet" | "solana_wallet" | "email" | "oauth";

export interface AuthMethod {
  type: AuthMethodType;
  identifier: string;
  verifiedAt?: Date;
  provider?: string;
}

export interface UserPreferences {
  currency: string;
  timezone?: string;
  locale?: string;
  theme?: "light" | "dark" | "system";
  notifications?: Record<string, boolean>;
}

export interface UserDocument extends Timestamps {
  _id: string;
  primaryWalletAddress?: string;
  primaryWalletChain?: "ethereum" | "solana";
  authMethods: AuthMethod[];
  preferences: UserPreferences;
  status: UserStatus;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  role?: "user" | "admin";
  lastLoginAt?: Date;
  deletedAt?: Date;
}
