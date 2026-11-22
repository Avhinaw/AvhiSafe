"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLink, Copy, QrCode, RefreshCw, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import {
  Chain,
  PortfolioAddress,
  PortfolioSnapshot,
  getStoredWatchAddresses,
  loadPortfolio,
  loadPortfolioHistory,
  saveWatchAddresses,
} from "@/lib/portfolio";
import { readPublicIndex } from "@/lib/vault";
import { readConnectedWallets } from "@/lib/connectedWallet";
import { listServerWallets } from "@/lib/walletApi";
import { useAuth } from "./AuthProvider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const chainNames: Record<Chain, string> = { ethereum: "Ethereum", solana: "Solana" };
const chainBadgeClasses: Record<Chain, string> = {
  ethereum: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  solana: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
};

function formatAmount(value: number, maximumFractionDigits = 6) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function formatUsd(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function inferChain(path: string | undefined): Chain {
  return path?.includes("501") ? "solana" : "ethereum";
}

// Renders points as a smooth sparkline instead of independent bars, so a viewer
// reads it as one trend rather than N separate measurements.
function Sparkline({ points }: { points: Array<{ timestamp: number; value: number }> }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (points.length < 2) return <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-primary/15 bg-primary/[0.02] text-xs font-semibold text-primary/40">Collecting trend data…</div>;
  const width = 640;
  const height = 180;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = points.map((point, index) => {
    const x = 12 + (index / (points.length - 1)) * (width - 24);
    const y = 18 + (1 - (point.value - min) / range) * (height - 42);
    return { x, y };
  });
  const trendUp = values[values.length - 1] >= values[0];
  const stroke = trendUp ? "rgb(45 212 191)" : "rgb(251 113 133)";
  const line = coords.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `12,${height - 18} ${line} ${width - 12},${height - 18}`;
  const active = activeIndex === null ? null : points[activeIndex];
  const activePoint = activeIndex === null ? null : coords[activeIndex];
  return (
    <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-primary/10 bg-primary/[0.025] p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Portfolio value trend chart">
        {[45, 90, 135].map((y) => <line key={y} x1="12" x2={width - 12} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 6" />)}
        <polygon points={area} fill={stroke} fillOpacity="0.1" />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((point, index) => <circle key={points[index].timestamp} cx={point.x} cy={point.y} r={activeIndex === index ? 6 : 3.5} fill="hsl(var(--background))" stroke={stroke} strokeWidth="2" onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} tabIndex={0} role="button" aria-label={`${formatUsd(points[index].value)} on ${new Date(points[index].timestamp).toLocaleString()}`} />)}
        {activePoint && active && <g pointerEvents="none"><line x1={activePoint.x} x2={activePoint.x} y1="14" y2={height - 18} stroke={stroke} strokeDasharray="3 4" strokeOpacity="0.65" /><rect x={Math.min(Math.max(activePoint.x - 62, 8), width - 132)} y="8" width="124" height="38" rx="9" fill="hsl(var(--foreground))" /><text x={Math.min(Math.max(activePoint.x, 70), width - 70)} y="24" textAnchor="middle" fill="hsl(var(--background))" fontSize="14" fontWeight="700">{formatUsd(active.value)}</text><text x={Math.min(Math.max(activePoint.x, 70), width - 70)} y="37" textAnchor="middle" fill="hsl(var(--background))" fillOpacity="0.65" fontSize="9">{new Date(active.timestamp).toLocaleDateString()}</text></g>}
      </svg>
      <div className="pointer-events-none absolute bottom-2 left-4 right-4 flex justify-between text-[10px] font-semibold text-primary/35"><span>{new Date(points[0].timestamp).toLocaleDateString()}</span><span>Hover points for details</span><span>{new Date(points[points.length - 1].timestamp).toLocaleDateString()}</span></div>
    </div>
  );
}

interface PortfolioDashboardProps {
  // When true, this renders as a nested widget inside a larger grid layout
  // instead of as a standalone top-level page section — drops the
  // section-divider spacing and shrinks the hero heading so it doesn't
  // dominate a small card slot.
  embedded?: boolean;
}

export default function PortfolioDashboard({ embedded = false }: PortfolioDashboardProps) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<PortfolioAddress[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQr, setSelectedQr] = useState<PortfolioAddress | null>(null);
  const [tokenQuery, setTokenQuery] = useState("");
  const [history, setHistory] = useState<Array<{ timestamp: number; value: number }>>([]);
  const refreshRequest = useRef(0);

  const syncAddresses = useCallback(async () => {
    const wallets = readPublicIndex();
    const generated: PortfolioAddress[] = wallets.map((wallet, index) => ({
      id: `wallet-${index}-${wallet.publicKey}`,
      label: wallet.label || `Wallet ${index + 1}`,
      address: wallet.publicKey,
      chain: inferChain(wallet.path),
      source: "wallet",
      walletIndex: index,
    }));
    const connected = readConnectedWallets().map((wallet): PortfolioAddress => ({ id: `connected-${wallet.id}`, label: wallet.label, address: wallet.address, chain: wallet.chain, source: "connected" }));
    const serverWallets = await listServerWallets().catch(() => ({ wallets: [] }));
    const restored = serverWallets.wallets.filter((wallet) => wallet.status === "active").map((wallet): PortfolioAddress => ({ id: `server-${wallet._id}`, label: wallet.label || `${wallet.sourceType === "generated" ? "Generated" : "Saved"} ${wallet.chainFamily}`, address: wallet.address, chain: wallet.chainFamily, source: wallet.sourceType === "watch_only" ? "watch" : wallet.sourceType === "generated" ? "wallet" : "connected" }));
    const combined = [...generated, ...connected, ...restored, ...getStoredWatchAddresses().filter((watch) => !generated.some((item) => item.address === watch.address && item.chain === watch.chain) && !connected.some((item) => item.address === watch.address && item.chain === watch.chain) && !restored.some((item) => item.address === watch.address && item.chain === watch.chain))];
    setAddresses(combined);
  }, []);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequest.current;
    setLoading(true);
    try {
      const results = await loadPortfolio(addresses);
      if (requestId === refreshRequest.current) {
        setSnapshots(results);
        const value = results.reduce((sum, snapshot) => sum + (snapshot.nativeValueUsd || 0) + snapshot.tokens.reduce((tokenSum, token) => tokenSum + (token.valueUsd || 0), 0), 0);
        setHistory((previous) => {
          const nextHistory = [...previous, { timestamp: Date.now(), value }].slice(-14);
          localStorage.setItem("portfolioHistory", JSON.stringify(nextHistory));
          return nextHistory;
        });
      }
    } catch (error) {
      if (requestId === refreshRequest.current) setSnapshots(addresses.map((address) => ({ address, nativeSymbol: address.chain === "ethereum" ? "ETH" : "SOL", nativeBalance: 0, tokens: [], transactions: [], explorerUrl: "", updatedAt: Date.now(), fetchedAt: Date.now(), source: "backend", dataQuality: "error" as const, error: error instanceof Error ? error.message : "Unable to load portfolio data" })));
    } finally {
      if (requestId === refreshRequest.current) setLoading(false);
    }
  }, [addresses]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem("portfolioHistory") || "[]")); } catch { setHistory([]); }
    if (user) void loadPortfolioHistory().then((points) => setHistory(points.map(({ timestamp, value }) => ({ timestamp, value })))).catch(() => undefined);
    syncAddresses();
    const handler = () => syncAddresses();
    window.addEventListener("avhisafe:wallets-updated", handler);
    window.addEventListener("avhisafe:connected-wallets-updated", handler);
    return () => { window.removeEventListener("avhisafe:wallets-updated", handler); window.removeEventListener("avhisafe:connected-wallets-updated", handler); };
  }, [syncAddresses, user]);

  useEffect(() => {
    if (addresses.length) refresh();
    else setSnapshots([]);
  }, [addresses, refresh]);

  const totalUsd = useMemo(() => snapshots.reduce((sum, snapshot) => sum + (snapshot.nativeValueUsd || 0) + snapshot.tokens.reduce((tokenSum, token) => tokenSum + (token.valueUsd || 0), 0), 0), [snapshots]);

  const changeVsFirst = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0].value;
    if (!first) return null;
    return ((totalUsd - first) / first) * 100;
  }, [history, totalUsd]);

  const removeWatchAddress = (address: PortfolioAddress) => {
    saveWatchAddresses(getStoredWatchAddresses().filter((item) => item.id !== address.id));
    syncAddresses();
    toast.success("Watch-only address removed.");
  };

  const copyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address);
    toast.success("Address copied.");
  };

  return (
    <section className={embedded ? "min-w-0 overflow-hidden" : "mt-16 min-w-0 overflow-hidden border-t border-primary/10 pt-12"}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className={embedded ? "text-xl font-black tracking-tight sm:text-2xl" : "text-2xl font-black tracking-tighter sm:text-4xl"}>
            Your on-chain view
          </h2>
          <p className="mt-2 max-w-md text-sm text-primary/70">
            Balances come from public blockchain data. AvhiSafe never signs transactions or handles private keys here.
          </p>
        </div>
        <Button onClick={refresh} disabled={loading || !addresses.length} variant="outline" className="gap-2">
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
        </Button>
      </div>

      {/* Hero stat: one number carries the section, the sparkline shows momentum
          instead of splitting attention across three identical cards. */}
      <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-primary/10 bg-primary/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-primary/60">Estimated portfolio value</p>
          <p className="mt-1 text-4xl font-black tracking-tight sm:text-5xl">{formatUsd(totalUsd)}</p>
          <p className="mt-2 text-sm text-primary/60">
            {addresses.length} tracked {addresses.length === 1 ? "address" : "addresses"}
            {changeVsFirst !== null && (
              <span className={changeVsFirst >= 0 ? "ml-2 text-emerald-600" : "ml-2 text-rose-600"}>
                {changeVsFirst >= 0 ? "+" : ""}{changeVsFirst.toFixed(1)}% over last {history.length} refreshes
              </span>
            )}
          </p>
        </div>
        {history.length >= 2 && (
          <div className="w-full sm:w-48">
            <Sparkline points={history} />
          </div>
        )}
      </div>

      {addresses.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-primary/20 p-10 text-center">
          <WalletCards className="mx-auto mb-4 size-10 text-primary/40" />
          <h3 className="text-xl font-bold">No wallets to track yet</h3>
          <p className="mt-2 text-primary/60">Generate a wallet, or add a public address below to watch its balance.</p>
        </div>
      ) : (
        <>
          <div className="mt-8">
            <Input value={tokenQuery} onChange={(event) => setTokenQuery(event.target.value)} placeholder="Search token holdings across wallets" />
          </div>

          <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
            {snapshots.map((snapshot) => (
              <article key={snapshot.address.id} className="min-w-0 overflow-hidden rounded-2xl border border-primary/10 bg-secondary/30 p-4 sm:p-6">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${chainBadgeClasses[snapshot.address.chain]}`}>
                        {chainNames[snapshot.address.chain]}
                      </span>
                      <span className="text-xs text-primary/50">
                        {snapshot.address.source === "watch" ? "Watch-only" : snapshot.address.source === "connected" ? "Connected wallet" : "Generated wallet"}
                      </span>
                    </div>
                    <h3 className="mt-3 truncate text-lg font-bold tracking-tight sm:text-2xl">{snapshot.address.label}</h3>
                    <p className="mt-1 truncate font-mono text-xs text-primary/60">{snapshot.address.address}</p>
                    <p className="mt-2 text-xs text-primary/50">Source: {snapshot.source} · {snapshot.dataQuality} · {new Date(snapshot.fetchedAt).toLocaleTimeString()}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyAddress(snapshot.address.address)} aria-label="Copy address"><Copy className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedQr(snapshot.address)} aria-label="Show QR code"><QrCode className="size-4" /></Button>
                    {snapshot.address.source === "watch" && (
                      <Button variant="ghost" size="icon" onClick={() => removeWatchAddress(snapshot.address)} aria-label="Remove address"><Trash2 className="size-4 text-destructive" /></Button>
                    )}
                  </div>
                </div>

                {snapshot.error ? (
                  <p className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{snapshot.error}</p>
                ) : (
                  <>
                    <div className="mt-6 flex items-end justify-between border-t border-primary/10 pt-4">
                      <div className="min-w-0">
                        <p className="text-sm text-primary/60">Native balance</p>
                        <p className="text-xl font-black sm:text-2xl">
                          {formatAmount(snapshot.nativeBalance)} <span className="text-sm font-bold text-primary/50">{snapshot.nativeSymbol}</span>
                        </p>
                      </div>
                      <p className="text-lg font-bold">{formatUsd(snapshot.nativeValueUsd)}</p>
                    </div>

                    <div className="mt-6">
                      <h4 className="text-sm font-bold text-primary/70">Token holdings ({snapshot.tokens.length})</h4>
                      {snapshot.tokens.length ? (
                        <div className="mt-2 divide-y divide-primary/10">
                          {snapshot.tokens
                            .filter((token) => token.symbol.toLowerCase().includes(tokenQuery.toLowerCase()) || token.name.toLowerCase().includes(tokenQuery.toLowerCase()))
                            .slice(0, 6)
                            .map((token) => (
                              <div key={token.id} className="flex min-w-0 items-center justify-between gap-3 py-2.5 text-sm">
                                <span className="min-w-0 truncate">
                                  <strong>{token.symbol}</strong>
                                  <span className="ml-2 text-primary/50">{token.name}</span>
                                </span>
                                <span className="shrink-0 text-right">
                                  {formatAmount(token.amount)}
                                  <span className="ml-2 text-xs text-primary/50">{formatUsd(token.valueUsd)}</span>
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-primary/50">No token balances found.</p>
                      )}
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-primary/70">Recent activity</h4>
                        <a href={snapshot.explorerUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-primary/70 hover:text-primary">
                          Explorer <ExternalLink className="size-3" />
                        </a>
                      </div>
                      {snapshot.transactions.length ? (
                        <div className="mt-2 divide-y divide-primary/10">
                          {snapshot.transactions.slice(0, 5).map((tx) => (
                            <a key={tx.hash} href={tx.explorerUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center justify-between gap-3 py-2.5 text-sm hover:text-primary">
                              <span className="min-w-0 truncate font-mono">{tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}</span>
                              <span className="shrink-0 text-primary/50">{tx.status || "View"}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-primary/50">No recent transactions.</p>
                      )}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {selectedQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedQr(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-8 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-2xl font-bold">Receive on {chainNames[selectedQr.chain]}</h3>
            <p className="mt-2 text-sm text-primary/60">Share this public address only. Never share a private key or recovery phrase.</p>
            <div className="mx-auto my-6 flex w-fit rounded-xl bg-white p-4"><QRCodeSVG value={selectedQr.address} size={220} includeMargin /></div>
            <p className="break-all font-mono text-xs text-primary/70">{selectedQr.address}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button className="flex-1" onClick={() => copyAddress(selectedQr.address)}>Copy address</Button>
              <Button variant="outline" onClick={() => setSelectedQr(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
