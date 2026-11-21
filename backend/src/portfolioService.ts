import { randomUUID } from "node:crypto";
import { normalizeWalletAddress, type WalletChainFamily } from "./walletValidation.js";

export type PortfolioRequestAddress = {
  id: string;
  label: string;
  address: string;
  chain: WalletChainFamily;
  source: "wallet" | "watch" | "connected";
};

export type PortfolioToken = {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  priceUsd?: number;
  valueUsd?: number;
  contract?: string;
};

export type PortfolioTransaction = {
  hash: string;
  timestamp?: number;
  from?: string;
  to?: string;
  value?: number;
  status?: string;
  explorerUrl: string;
};

export type PortfolioSnapshot = {
  address: PortfolioRequestAddress;
  nativeSymbol: string;
  nativeBalance: number;
  nativePriceUsd?: number;
  nativeValueUsd?: number;
  tokens: PortfolioToken[];
  transactions: PortfolioTransaction[];
  explorerUrl: string;
  updatedAt: number;
  fetchedAt: number;
  source: string;
  dataQuality: "complete" | "partial" | "unavailable" | "error";
  error?: string;
};

type CacheEntry = { expiresAt: number; value: Record<string, { usd?: number }> };
const priceCache = new Map<string, CacheEntry>();
const PORTFOLIO_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000;

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PORTFOLIO_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: "application/json", ...(init?.headers || {}) } });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function prices() {
  const key = "native-usd";
  const cached = priceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const result = await fetchJson<Record<string, { usd?: number }>>("https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum&vs_currencies=usd");
    priceCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
    return result;
  } catch {
    return cached?.value || {};
  }
}

function explorerUrl(address: string, chain: WalletChainFamily) {
  return chain === "ethereum" ? `https://etherscan.io/address/${address}` : `https://solscan.io/account/${address}`;
}

function transactionExplorerUrl(hash: string, chain: WalletChainFamily) {
  return chain === "ethereum" ? `https://etherscan.io/tx/${hash}` : `https://solscan.io/tx/${hash}`;
}

async function loadSolana(address: PortfolioRequestAddress): Promise<PortfolioSnapshot> {
  const rpc = process.env.SOLANA_RPC_URL || "https://solana-rpc.publicnode.com";
  const rpcCall = <T>(method: string, params: unknown[]) => fetchJson<{ result?: T; error?: { message?: string } }>(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }) }).then((payload) => { if (payload.error) throw new Error(payload.error.message || "Solana RPC error"); return payload.result as T; });
  const [balanceResult, signatures, tokenResult, priceData] = await Promise.all([
    rpcCall<{ value: number }>("getBalance", [address.address, { commitment: "finalized" }]),
    rpcCall<Array<{ signature: string; blockTime?: number; err?: unknown }>>("getSignaturesForAddress", [address.address, { limit: 12, commitment: "finalized" }]),
    rpcCall<{ value: Array<{ account: { data: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmountString?: string; decimals?: number } } } } } }> }>("getTokenAccountsByOwner", [address.address, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed", commitment: "finalized" }]).catch(() => ({ value: [] })),
    prices(),
  ]);
  const tokens = tokenResult.value.map((item): PortfolioToken | null => { const info = item.account.data.parsed?.info; const amount = asNumber(info?.tokenAmount?.uiAmountString); return info?.mint && amount > 0 ? { id: info.mint, symbol: "SPL", name: `SPL token ${info.mint.slice(0, 6)}…`, amount, decimals: info.tokenAmount?.decimals || 0, contract: info.mint } : null; }).filter((token): token is PortfolioToken => token !== null);
  const nativeBalance = balanceResult.value / 1_000_000_000;
  const nativePriceUsd = priceData.solana?.usd;
  return { address, nativeSymbol: "SOL", nativeBalance, nativePriceUsd, nativeValueUsd: nativePriceUsd ? nativeBalance * nativePriceUsd : undefined, tokens, transactions: signatures.map((tx) => ({ hash: tx.signature, timestamp: tx.blockTime, status: tx.err ? "Failed" : "Confirmed", explorerUrl: transactionExplorerUrl(tx.signature, "solana") })), explorerUrl: explorerUrl(address.address, "solana"), updatedAt: Date.now(), fetchedAt: Date.now(), source: "solana-rpc", dataQuality: tokens.length || signatures.length ? "complete" : "partial" };
}

async function loadEthereum(address: PortfolioRequestAddress): Promise<PortfolioSnapshot> {
  const base = process.env.ETHEREUM_INDEXER_URL || "https://api.ethplorer.io";
  const apiKey = process.env.ETHEREUM_INDEXER_API_KEY || "freekey";
  const [addressData, transactionData, priceData] = await Promise.all([
    fetchJson<any>(`${base}/getAddressInfo/${address.address}?apiKey=${encodeURIComponent(apiKey)}&showTxsCount=true`),
    fetchJson<any>(`${base}/getAddressTransactions/${address.address}?apiKey=${encodeURIComponent(apiKey)}&limit=12`).catch(() => ({ operations: [] })),
    prices(),
  ]);
  if (addressData.error) throw new Error(addressData.error.message || "Ethereum indexer error");
  const nativeBalance = asNumber(addressData.ETH?.balance);
  const nativePriceUsd = asNumber(addressData.ETH?.price?.rate || priceData.ethereum?.usd, undefined as unknown as number);
  const tokens = (addressData.tokens || []).map((token: any) => { const amount = asNumber(token.balance) / 10 ** asNumber(token.tokenInfo?.decimals); const priceUsd = asNumber(token.tokenInfo?.price?.rate, undefined as unknown as number); return { id: token.tokenInfo?.address || token.tokenInfo?.symbol || randomUUID(), symbol: token.tokenInfo?.symbol || "TOKEN", name: token.tokenInfo?.name || "ERC-20 token", amount, decimals: asNumber(token.tokenInfo?.decimals), priceUsd: priceUsd || undefined, valueUsd: priceUsd ? amount * priceUsd : undefined, contract: token.tokenInfo?.address }; }).filter((token: PortfolioToken) => token.amount > 0);
  const operations = transactionData.operations || transactionData || [];
  return { address, nativeSymbol: "ETH", nativeBalance, nativePriceUsd: nativePriceUsd || undefined, nativeValueUsd: nativePriceUsd ? nativeBalance * nativePriceUsd : undefined, tokens, transactions: operations.slice(0, 12).map((tx: any) => ({ hash: tx.transactionHash || tx.hash, timestamp: tx.timestamp, from: tx.from, to: tx.to, value: asNumber(tx.value), status: tx.success === false ? "Failed" : "Confirmed", explorerUrl: transactionExplorerUrl(tx.transactionHash || tx.hash, "ethereum") })).filter((tx: PortfolioTransaction) => Boolean(tx.hash)), explorerUrl: explorerUrl(address.address, "ethereum"), updatedAt: Date.now(), fetchedAt: Date.now(), source: "ethplorer", dataQuality: tokens.length || operations.length ? "complete" : "partial" };
}

export async function loadPortfolioAddress(input: PortfolioRequestAddress): Promise<PortfolioSnapshot> {
  const address = { ...input, address: normalizeWalletAddress(input.chain, input.address) };
  try { return address.chain === "ethereum" ? await loadEthereum(address) : await loadSolana(address); }
  catch (error) { return { address, nativeSymbol: address.chain === "ethereum" ? "ETH" : "SOL", nativeBalance: 0, tokens: [], transactions: [], explorerUrl: explorerUrl(address.address, address.chain), updatedAt: Date.now(), fetchedAt: Date.now(), source: address.chain === "ethereum" ? "ethplorer" : "solana-rpc", dataQuality: "error", error: error instanceof Error ? error.message : "Unable to load portfolio data" }; }
}
