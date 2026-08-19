export type ConnectedWalletChain = "ethereum" | "solana";

export interface ConnectedWallet {
  id: string;
  chain: ConnectedWalletChain;
  address: string;
  provider: string;
  label: string;
  chainId?: string;
  connectedAt: number;
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface SolanaProvider {
  publicKey?: { toString(): string };
  isConnected?: boolean;
  connect(): Promise<{ publicKey?: { toString(): string } }>;
  disconnect?: () => Promise<void>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
  }
}

const STORAGE_KEY = "avhisafe.connectedWallets.v1";

export function getEvmProvider() {
  return typeof window !== "undefined" ? window.ethereum : undefined;
}

export function getSolanaProvider() {
  if (typeof window === "undefined") return undefined;
  return window.phantom?.solana || window.solana;
}

export function readConnectedWallets(): ConnectedWallet[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as ConnectedWallet[]; } catch { return []; }
}

function saveConnectedWallets(wallets: ConnectedWallet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  window.dispatchEvent(new Event("avhisafe:connected-wallets-updated"));
}

export async function connectEvmWallet(): Promise<ConnectedWallet> {
  const provider = getEvmProvider();
  if (!provider) throw new Error("No browser EVM wallet detected. Install MetaMask or another EIP-1193 wallet.");
  const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
  if (!accounts?.[0]) throw new Error("The wallet did not return an account.");
  const chainId = await provider.request({ method: "eth_chainId" }) as string;
  const connected: ConnectedWallet = { id: `ethereum-${accounts[0].toLowerCase()}`, chain: "ethereum", address: accounts[0], provider: "EVM browser wallet", label: "Connected EVM wallet", chainId, connectedAt: Date.now() };
  saveConnectedWallets([...readConnectedWallets().filter((item) => item.id !== connected.id && item.chain !== "ethereum"), connected]);
  return connected;
}

export async function connectSolanaWallet(): Promise<ConnectedWallet> {
  const provider = getSolanaProvider();
  if (!provider) throw new Error("No browser Solana wallet detected. Install Phantom or another Solana wallet.");
  const result = await provider.connect();
  const address = result.publicKey?.toString() || provider.publicKey?.toString();
  if (!address) throw new Error("The Solana wallet did not return a public key.");
  const connected: ConnectedWallet = { id: `solana-${address}`, chain: "solana", address, provider: "Solana browser wallet", label: "Connected Solana wallet", connectedAt: Date.now() };
  saveConnectedWallets([...readConnectedWallets().filter((item) => item.id !== connected.id && item.chain !== "solana"), connected]);
  return connected;
}

export async function disconnectWallet(wallet: ConnectedWallet) {
  if (wallet.chain === "solana") {
    try { await getSolanaProvider()?.disconnect?.(); } catch { /* local disconnect still succeeds */ }
  }
  saveConnectedWallets(readConnectedWallets().filter((item) => item.id !== wallet.id));
}

export function clearConnectedWallets() {
  if (typeof window !== "undefined") saveConnectedWallets([]);
}
