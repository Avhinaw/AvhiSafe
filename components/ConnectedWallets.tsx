"use client";

import { useEffect, useState } from "react";
import { Link2, LogOut, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { getEvmProvider, getSolanaProvider, connectEvmWallet, connectSolanaWallet, disconnectWallet, readConnectedWallets, ConnectedWallet } from "@/lib/connectedWallet";

function shortAddress(address: string) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }

export default function ConnectedWallets() {
  const [wallets, setWallets] = useState<ConnectedWallet[]>([]);
  const [evmDetected, setEvmDetected] = useState(false);
  const [solanaDetected, setSolanaDetected] = useState(false);
  const [busy, setBusy] = useState<"ethereum" | "solana" | null>(null);

  useEffect(() => {
    const sync = () => setWallets(readConnectedWallets());
    sync();
    setEvmDetected(Boolean(getEvmProvider()));
    setSolanaDetected(Boolean(getSolanaProvider()));
    window.addEventListener("avhisafe:connected-wallets-updated", sync);
    const ethereum = getEvmProvider();
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      if (!accounts?.[0]) setWallets((current) => current.filter((wallet) => wallet.chain !== "ethereum"));
      else void connectEvmWallet().catch(() => undefined);
    };
    const onChainChanged = () => void connectEvmWallet().catch(() => undefined);
    ethereum?.on?.("accountsChanged", onAccountsChanged);
    ethereum?.on?.("chainChanged", onChainChanged);
    return () => {
      window.removeEventListener("avhisafe:connected-wallets-updated", sync);
      ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
      ethereum?.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  const connect = async (chain: "ethereum" | "solana") => {
    setBusy(chain);
    try { await (chain === "ethereum" ? connectEvmWallet() : connectSolanaWallet()); toast.success(`${chain === "ethereum" ? "EVM" : "Solana"} wallet connected for read-only portfolio viewing.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Wallet connection failed."); }
    finally { setBusy(null); }
  };

  return <section className="min-w-0 overflow-hidden rounded-2xl border border-primary/10 bg-primary/[0.03] p-4 sm:p-6"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary/50">Third-party wallets</p><h2 className="mt-1 text-2xl font-black">Connect and view</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-primary/60">Connect MetaMask or another EVM wallet, or connect Phantom and another Solana wallet. AvhiSafe requests only the public address and never signs or sends transactions.</p></div><WalletCards className="size-7 text-primary/40" /></div><div className="mt-5 grid gap-3 sm:flex sm:flex-wrap"><Button onClick={() => connect("ethereum")} disabled={busy !== null} className="w-full gap-2 sm:w-auto"><Link2 className="size-4" />{busy === "ethereum" ? "Connecting…" : "Connect MetaMask / EVM"}</Button><Button onClick={() => connect("solana")} disabled={busy !== null} variant="outline" className="w-full gap-2 sm:w-auto">{busy === "solana" ? "Connecting…" : "Connect Solana wallet"}</Button></div><div className="mt-4 flex flex-col gap-2 text-xs text-primary/50 sm:flex-row sm:flex-wrap sm:gap-3"><span>{evmDetected ? "EVM provider detected" : "No EVM provider detected"}</span><span>{solanaDetected ? "Solana provider detected" : "No Solana provider detected"}</span></div>{wallets.length > 0 && <div className="mt-5 grid gap-3 md:grid-cols-2">{wallets.map((wallet) => <div key={wallet.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-background/70 p-4"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-primary/50">{wallet.chain === "ethereum" ? "EVM" : "Solana"} · {wallet.provider}</p><p className="mt-1 font-mono text-sm">{shortAddress(wallet.address)}</p><p className="mt-1 text-xs text-emerald-600">Connected for read-only viewing</p></div><Button variant="ghost" size="icon" onClick={() => disconnectWallet(wallet)} aria-label={`Disconnect ${wallet.chain} wallet`}><LogOut className="size-4" /></Button></div>)}</div>}</section>;
}
