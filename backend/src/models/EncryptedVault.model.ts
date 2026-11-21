import type { Timestamps } from "./base.js";

export interface EncryptedVaultDocument extends Timestamps {
  _id: string;
  userId: string;
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
}
