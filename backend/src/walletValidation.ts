import { getAddress } from "ethers";
import bs58 from "bs58";

export type WalletChainFamily = "ethereum" | "solana";

export function normalizeWalletAddress(chainFamily: WalletChainFamily, address: string) {
  if (chainFamily === "ethereum") return getAddress(address).toLowerCase();
  const decoded = bs58.decode(address);
  if (decoded.length !== 32) throw new Error("Invalid Solana address.");
  return bs58.encode(decoded);
}

export function displayWalletAddress(chainFamily: WalletChainFamily, normalizedAddress: string) {
  return chainFamily === "ethereum" ? getAddress(normalizedAddress) : normalizedAddress;
}
