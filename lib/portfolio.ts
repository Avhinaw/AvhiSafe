import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";
import { backendUrl, notifySessionExpired } from "./authApi";

export type Chain = "solana" | "ethereum";
export interface PortfolioAddress { id: string; label: string; address: string; chain: Chain; source: "wallet" | "watch" | "connected"; walletIndex?: number; }
export interface PortfolioToken { id: string; symbol: string; name: string; amount: number; decimals: number; priceUsd?: number; valueUsd?: number; contract?: string; }
export interface PortfolioTransaction { hash: string; timestamp?: number; from?: string; to?: string; value?: number; status?: string; explorerUrl: string; }
export interface PortfolioSnapshot { address: PortfolioAddress; nativeSymbol: string; nativeBalance: number; nativePriceUsd?: number; nativeValueUsd?: number; tokens: PortfolioToken[]; transactions: PortfolioTransaction[]; explorerUrl: string; updatedAt: number; fetchedAt: number; source: string; dataQuality: "complete" | "partial" | "unavailable" | "error"; error?: string; }
export interface PortfolioHistoryPoint { timestamp: number; value: number; walletId?: string; source: string; dataQuality: string; }

export function validateAddress(address: string, chain: Chain): boolean {
  try { if (chain === "ethereum") return ethers.isAddress(address); new PublicKey(address); return true; } catch { return false; }
}
export function explorerUrl(address: string, chain: Chain): string { return chain === "ethereum" ? `https://etherscan.io/address/${address}` : `https://solscan.io/account/${address}`; }
export function transactionExplorerUrl(hash: string, chain: Chain): string { return chain === "ethereum" ? `https://etherscan.io/tx/${hash}` : `https://solscan.io/tx/${hash}`; }

export async function loadPortfolio(addresses: PortfolioAddress[]): Promise<PortfolioSnapshot[]> {
  const response = await fetch(`${backendUrl}/api/v1/portfolio`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addresses }) });
  if (response.status === 401) notifySessionExpired();
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error || `Portfolio request failed (${response.status}).`); }
  return (await response.json() as { snapshots: PortfolioSnapshot[] }).snapshots;
}

export async function loadPortfolioHistory(limit = 100): Promise<PortfolioHistoryPoint[]> {
  const response = await fetch(`${backendUrl}/api/v1/portfolio/history?limit=${limit}`, { credentials: "include" });
  if (response.status === 401) notifySessionExpired();
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error || `Portfolio history request failed (${response.status}).`); }
  return (await response.json() as { history: PortfolioHistoryPoint[] }).history;
}

export function getStoredWatchAddresses(): PortfolioAddress[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem("watchAddresses") || "[]") as PortfolioAddress[]; } catch { return []; } }
export function saveWatchAddresses(addresses: PortfolioAddress[]) { localStorage.setItem("watchAddresses", JSON.stringify(addresses)); }
