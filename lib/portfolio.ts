import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";

export type Chain = "solana" | "ethereum";

export interface PortfolioAddress {
  id: string;
  label: string;
  address: string;
  chain: Chain;
  source: "wallet" | "watch" | "connected";
  walletIndex?: number;
}

export interface PortfolioToken {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  priceUsd?: number;
  valueUsd?: number;
  contract?: string;
}

export interface PortfolioTransaction {
  hash: string;
  timestamp?: number;
  from?: string;
  to?: string;
  value?: number;
  status?: string;
  explorerUrl: string;
}

export interface PortfolioSnapshot {
  address: PortfolioAddress;
  nativeSymbol: string;
  nativeBalance: number;
  nativePriceUsd?: number;
  nativeValueUsd?: number;
  tokens: PortfolioToken[];
  transactions: PortfolioTransaction[];
  explorerUrl: string;
  updatedAt: number;
  error?: string;
}

const SOLANA_RPC = "https://solana-rpc.publicnode.com";
const ETHPLORER_API = "https://api.ethplorer.io";

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  if (!response.ok) throw new Error(`Solana RPC returned ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || "Solana RPC error");
  return payload.result as T;
}

async function fetchPrices(): Promise<Record<string, { usd?: number; usd_24h_change?: number }>> {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum&vs_currencies=usd&include_24hr_change=true", { headers: { Accept: "application/json" } }
  );
  if (!response.ok) return {};
  return response.json();
}

export function validateAddress(address: string, chain: Chain): boolean {
  try {
    if (chain === "ethereum") return ethers.isAddress(address);
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export function explorerUrl(address: string, chain: Chain): string {
  return chain === "ethereum"
    ? `https://etherscan.io/address/${address}`
    : `https://solscan.io/account/${address}`;
}

export function transactionExplorerUrl(hash: string, chain: Chain): string {
  return chain === "ethereum"
    ? `https://etherscan.io/tx/${hash}`
    : `https://solscan.io/tx/${hash}`;
}

async function loadSolana(address: PortfolioAddress): Promise<PortfolioSnapshot> {
  const [balanceResult, signatures, prices] = await Promise.all([
    solanaRpc<{ value: number }>("getBalance", [address.address, { commitment: "finalized" }]),
    solanaRpc<Array<{ signature: string; blockTime?: number; err?: unknown }>>("getSignaturesForAddress", [address.address, { limit: 12, commitment: "finalized" }]),
    fetchPrices(),
  ]);

  let tokenAccounts: Array<{ account: { data: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmountString?: string; decimals?: number } } } } } }> = [];
  try {
    const tokenResult = await solanaRpc<{ value: typeof tokenAccounts }>(
      "getTokenAccountsByOwner",
      [address.address, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed", commitment: "finalized" }]
    );
    tokenAccounts = tokenResult.value;
  } catch {
    // Some public RPC providers restrict token-account scans. Native balance and activity remain useful.
  }

  const tokens = tokenAccounts
    .map((item): PortfolioToken | null => {
      const info = item.account.data.parsed?.info;
      const amount = asNumber(info?.tokenAmount?.uiAmountString);
      return info?.mint && amount > 0
        ? {
            id: info.mint,
            symbol: "SPL",
            name: `SPL token ${info.mint.slice(0, 6)}…`,
            amount,
            decimals: info.tokenAmount?.decimals || 0,
            contract: info.mint,
          }
        : null;
    })
    .filter((token): token is PortfolioToken => token !== null);
  const nativeBalance = balanceResult.value / 1_000_000_000;
  const nativePriceUsd = prices.solana?.usd;

  return {
    address,
    nativeSymbol: "SOL",
    nativeBalance,
    nativePriceUsd,
    nativeValueUsd: nativePriceUsd ? nativeBalance * nativePriceUsd : undefined,
    tokens,
    transactions: signatures.map((tx) => ({
      hash: tx.signature,
      timestamp: tx.blockTime,
      status: tx.err ? "Failed" : "Confirmed",
      explorerUrl: transactionExplorerUrl(tx.signature, "solana"),
    })),
    explorerUrl: explorerUrl(address.address, "solana"),
    updatedAt: Date.now(),
  };
}

async function loadEthereum(address: PortfolioAddress): Promise<PortfolioSnapshot> {
  const [addressResponse, transactionsResponse] = await Promise.all([
    fetch(`${ETHPLORER_API}/getAddressInfo/${address.address}?apiKey=freekey&showTxsCount=true`),
    fetch(`${ETHPLORER_API}/getAddressTransactions/${address.address}?apiKey=freekey&limit=12`),
  ]);
  if (!addressResponse.ok) throw new Error(`Ethereum indexer returned ${addressResponse.status}`);
  const addressData = await addressResponse.json();
  const transactionData = transactionsResponse.ok ? await transactionsResponse.json() : { operations: [] };
  if (addressData.error) throw new Error(addressData.error.message || "Ethereum indexer error");
  const prices = await fetchPrices();
  const nativeBalance = asNumber(addressData.ETH?.balance);
  const nativePriceUsd = asNumber(addressData.ETH?.price?.rate || prices.ethereum?.usd, undefined as unknown as number);
  const tokens = (addressData.tokens || []).map((token: any) => {
    const amount = asNumber(token.balance) / 10 ** asNumber(token.tokenInfo?.decimals);
    const priceUsd = asNumber(token.tokenInfo?.price?.rate, undefined as unknown as number);
    return {
      id: token.tokenInfo?.address || token.tokenInfo?.symbol,
      symbol: token.tokenInfo?.symbol || "TOKEN",
      name: token.tokenInfo?.name || "ERC-20 token",
      amount,
      decimals: asNumber(token.tokenInfo?.decimals),
      priceUsd: priceUsd || undefined,
      valueUsd: priceUsd ? amount * priceUsd : undefined,
      contract: token.tokenInfo?.address,
    } satisfies PortfolioToken;
  }).filter((token: PortfolioToken) => token.amount > 0);

  return {
    address,
    nativeSymbol: "ETH",
    nativeBalance,
    nativePriceUsd: nativePriceUsd || undefined,
    nativeValueUsd: nativePriceUsd ? nativeBalance * nativePriceUsd : undefined,
    tokens,
    transactions: (transactionData.operations || transactionData || []).slice(0, 12).map((tx: any) => ({
      hash: tx.transactionHash || tx.hash,
      timestamp: tx.timestamp,
      from: tx.from,
      to: tx.to,
      value: asNumber(tx.value),
      status: tx.success === false ? "Failed" : "Confirmed",
      explorerUrl: transactionExplorerUrl(tx.transactionHash || tx.hash, "ethereum"),
    })).filter((tx: PortfolioTransaction) => Boolean(tx.hash)),
    explorerUrl: explorerUrl(address.address, "ethereum"),
    updatedAt: Date.now(),
  };
}

export async function loadPortfolio(address: PortfolioAddress): Promise<PortfolioSnapshot> {
  try {
    return address.chain === "ethereum" ? await loadEthereum(address) : await loadSolana(address);
  } catch (error) {
    return {
      address,
      nativeSymbol: address.chain === "ethereum" ? "ETH" : "SOL",
      nativeBalance: 0,
      tokens: [],
      transactions: [],
      explorerUrl: explorerUrl(address.address, address.chain),
      updatedAt: Date.now(),
      error: error instanceof Error ? error.message : "Unable to load portfolio data",
    };
  }
}

export function getStoredWatchAddresses(): PortfolioAddress[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("watchAddresses") || "[]") as PortfolioAddress[];
  } catch {
    return [];
  }
}

export function saveWatchAddresses(addresses: PortfolioAddress[]) {
  localStorage.setItem("watchAddresses", JSON.stringify(addresses));
}
