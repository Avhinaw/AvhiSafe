"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLink, Copy, Plus, QrCode, RefreshCw, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import {
  Chain,
  PortfolioAddress,
  PortfolioSnapshot,
  getStoredWatchAddresses,
  loadPortfolio,
  saveWatchAddresses,
  validateAddress,
} from "@/lib/portfolio";
import { readPublicIndex } from "@/lib/vault";
import { readConnectedWallets } from "@/lib/connectedWallet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const chainNames: Record<Chain, string> = { ethereum: "Ethereum", solana: "Solana" };

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

export default function PortfolioDashboard() {
  const [addresses, setAddresses] = useState<PortfolioAddress[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [watchAddress, setWatchAddress] = useState("");
  const [watchLabel, setWatchLabel] = useState("");
  const [watchChain, setWatchChain] = useState<Chain>("ethereum");
  const [selectedQr, setSelectedQr] = useState<PortfolioAddress | null>(null);
  const [tokenQuery, setTokenQuery] = useState("");
  const [history, setHistory] = useState<Array<{ timestamp: number; value: number }>>([]);
  const refreshRequest = useRef(0);

  const syncAddresses = useCallback(() => {
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
    const combined = [...generated, ...connected, ...getStoredWatchAddresses().filter((watch) => !generated.some((item) => item.address === watch.address && item.chain === watch.chain) && !connected.some((item) => item.address === watch.address && item.chain === watch.chain))];
    setAddresses(combined);
  }, []);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequest.current;
    setLoading(true);
    const results = await Promise.all(addresses.map(loadPortfolio));
    if (requestId === refreshRequest.current) {
      setSnapshots(results);
      const value = results.reduce((sum, snapshot) => sum + (snapshot.nativeValueUsd || 0) + snapshot.tokens.reduce((tokenSum, token) => tokenSum + (token.valueUsd || 0), 0), 0);
      setHistory((previous) => {
        const nextHistory = [...previous, { timestamp: Date.now(), value }].slice(-14);
        localStorage.setItem("portfolioHistory", JSON.stringify(nextHistory));
        return nextHistory;
      });
      setLoading(false);
    }
  }, [addresses]);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem("portfolioHistory") || "[]")); } catch { setHistory([]); }
    syncAddresses();
    const handler = () => syncAddresses();
    window.addEventListener("avhisafe:wallets-updated", handler);
    window.addEventListener("avhisafe:connected-wallets-updated", handler);
    return () => { window.removeEventListener("avhisafe:wallets-updated", handler); window.removeEventListener("avhisafe:connected-wallets-updated", handler); };
  }, [syncAddresses]);

  useEffect(() => {
    if (addresses.length) refresh();
    else setSnapshots([]);
  }, [addresses, refresh]);

  const totalUsd = useMemo(() => snapshots.reduce((sum, snapshot) => sum + (snapshot.nativeValueUsd || 0) + snapshot.tokens.reduce((tokenSum, token) => tokenSum + (token.valueUsd || 0), 0), 0), [snapshots]);

  const addWatchAddress = () => {
    const address = watchAddress.trim();
    if (!validateAddress(address, watchChain)) {
      toast.error(`Enter a valid ${chainNames[watchChain]} address.`);
      return;
    }
    const watch: PortfolioAddress = {
      id: `watch-${watchChain}-${address}`,
      label: watchLabel.trim() || `Watched ${chainNames[watchChain]} address`,
      address,
      chain: watchChain,
      source: "watch",
    };
    const next = [...getStoredWatchAddresses().filter((item) => item.id !== watch.id), watch];
    saveWatchAddresses(next);
    setWatchAddress("");
    setWatchLabel("");
    syncAddresses();
    toast.success("Watch-only address added.");
  };

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
    <section className="mt-16 flex flex-col gap-6 border-t border-primary/10 pt-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary/50">Read-only portfolio</p>
          <h2 className="text-4xl font-black tracking-tighter md:text-5xl">Your on-chain view</h2>
          <p className="mt-2 max-w-2xl text-primary/70">Balances and activity are fetched from public blockchain data sources. AvhiSafe never signs transactions or sends private keys to these services.</p>
        </div>
        <Button onClick={refresh} disabled={loading || !addresses.length} variant="outline" className="gap-2">
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh data
        </Button>
      </div>

      <div className="mb-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="text-lg font-bold">Portfolio history</h3><p className="text-sm text-primary/50">Last 14 refresh snapshots, stored only in this browser.</p></div><div className="flex items-end gap-1">{history.slice(-14).map((point) => <div key={point.timestamp} title={`${new Date(point.timestamp).toLocaleString()}: ${formatUsd(point.value)}`} className="w-3 rounded-t bg-primary/50" style={{ height: `${Math.max(8, Math.min(48, point.value / Math.max(totalUsd, 1) * 48))}px` }} />)}</div></div>      <div className="mb-2 flex items-center gap-3"><Input value={tokenQuery} onChange={(event) => setTokenQuery(event.target.value)} placeholder="Search token holdings across wallets" /></div><div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-primary/10 bg-primary/[0.04] p-6"><p className="text-sm text-primary/60">Tracked addresses</p><p className="mt-2 text-3xl font-black">{addresses.length}</p></div>
        <div className="rounded-2xl border border-primary/10 bg-primary/[0.04] p-6"><p className="text-sm text-primary/60">Estimated portfolio value</p><p className="mt-2 text-3xl font-black">{formatUsd(totalUsd)}</p></div>
        <div className="rounded-2xl border border-primary/10 bg-primary/[0.04] p-6"><p className="text-sm text-primary/60">Data mode</p><p className="mt-2 text-3xl font-black">Read-only</p></div>
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/20 p-10 text-center"><WalletCards className="mx-auto mb-4 size-10 text-primary/40" /><h3 className="text-2xl font-bold">Generate a wallet to see your portfolio</h3><p className="mt-2 text-primary/60">You can also add a public address below as a watch-only portfolio.</p></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {snapshots.map((snapshot) => (
            <article key={snapshot.address.id} className="rounded-2xl border border-primary/10 bg-secondary/30 p-6">
              <div className="flex items-start justify-between gap-4">
                <div><div className="flex items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold">{chainNames[snapshot.address.chain]}</span><span className="text-xs text-primary/50">{snapshot.address.source === "watch" ? "Watch-only" : snapshot.address.source === "connected" ? "Connected wallet" : "Generated wallet"}</span></div><h3 className="mt-3 text-2xl font-bold tracking-tight">{snapshot.address.label}</h3><p className="mt-1 max-w-[28rem] truncate font-mono text-xs text-primary/60">{snapshot.address.address}</p></div>
                <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => copyAddress(snapshot.address.address)} aria-label="Copy address"><Copy className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => setSelectedQr(snapshot.address)} aria-label="Show QR code"><QrCode className="size-4" /></Button>{snapshot.address.source === "watch" && <Button variant="ghost" size="icon" onClick={() => removeWatchAddress(snapshot.address)} aria-label="Remove address"><Trash2 className="size-4 text-destructive" /></Button>}</div>
              </div>
              {snapshot.error ? <p className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{snapshot.error}</p> : <><div className="mt-6 flex items-end justify-between"><div><p className="text-sm text-primary/60">Native balance</p><p className="text-3xl font-black">{formatAmount(snapshot.nativeBalance)} <span className="text-base">{snapshot.nativeSymbol}</span></p></div><p className="text-right text-lg font-bold">{formatUsd(snapshot.nativeValueUsd)}</p></div><div className="mt-6"><h4 className="font-bold">Token holdings <span className="text-primary/50">({snapshot.tokens.length})</span></h4>{snapshot.tokens.length ? <div className="mt-3 flex flex-col gap-2">{snapshot.tokens.filter((token) => token.symbol.toLowerCase().includes(tokenQuery.toLowerCase()) || token.name.toLowerCase().includes(tokenQuery.toLowerCase())).slice(0, 6).map((token) => <div key={token.id} className="flex items-center justify-between rounded-lg bg-background/60 p-3 text-sm"><span><strong>{token.symbol}</strong><span className="ml-2 text-primary/50">{token.name}</span></span><span className="text-right">{formatAmount(token.amount)}<br /><span className="text-xs text-primary/50">{formatUsd(token.valueUsd)}</span></span></div>)}</div> : <p className="mt-3 text-sm text-primary/50">No non-zero token holdings were returned.</p>}</div><div className="mt-6"><div className="flex items-center justify-between"><h4 className="font-bold">Recent activity</h4><a href={snapshot.explorerUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-primary/70 hover:text-primary">Explorer <ExternalLink className="size-3" /></a></div>{snapshot.transactions.length ? <div className="mt-3 flex flex-col gap-2">{snapshot.transactions.slice(0, 5).map((tx) => <a key={tx.hash} href={tx.explorerUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg bg-background/60 p-3 text-sm hover:bg-background"><span className="font-mono">{tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}</span><span className="text-primary/50">{tx.status || "View"} <ExternalLink className="ml-1 inline size-3" /></span></a>)}</div> : <p className="mt-3 text-sm text-primary/50">No recent transactions returned.</p>}</div></>}
            </article>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-primary/10 p-6"><div className="flex items-center gap-3"><Plus className="size-5" /><div><h3 className="text-xl font-bold">Add a watch-only address</h3><p className="text-sm text-primary/60">Track a public address without importing its recovery phrase or private key.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"><Input value={watchLabel} onChange={(event) => setWatchLabel(event.target.value)} placeholder="Label (optional)" /><Input value={watchAddress} onChange={(event) => setWatchAddress(event.target.value)} placeholder="Public address" /><select value={watchChain} onChange={(event) => setWatchChain(event.target.value as Chain)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="ethereum">Ethereum</option><option value="solana">Solana</option></select><Button onClick={addWatchAddress}>Add address</Button></div></div>

      {selectedQr && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedQr(null)}><div className="w-full max-w-sm rounded-2xl bg-background p-8 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}><h3 className="text-2xl font-bold">Receive on {chainNames[selectedQr.chain]}</h3><p className="mt-2 text-sm text-primary/60">Share this public address only. Never share a private key or recovery phrase.</p><div className="mx-auto my-6 flex w-fit rounded-xl bg-white p-4"><QRCodeSVG value={selectedQr.address} size={220} includeMargin /></div><p className="break-all font-mono text-xs text-primary/70">{selectedQr.address}</p><div className="mt-6 flex gap-3"><Button className="flex-1" onClick={() => copyAddress(selectedQr.address)}>Copy address</Button><Button variant="outline" onClick={() => setSelectedQr(null)}>Close</Button></div></div></div>}
    </section>
  );
}
