"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Link2, LogIn, LogOut, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "./AuthProvider";
import { connectEvmWallet, connectSolanaWallet, getEvmProvider, getSolanaProvider } from "@/lib/connectedWallet";
import { listServerWallets, removeServerWallet, saveConnectedWallet, saveWatchOnlyWallet, type ServerWallet } from "@/lib/walletApi";

function shortAddress(address: string) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }

export default function ConnectedWallets() {
  const { user, signIn, signingIn } = useAuth();
  const [wallets, setWallets] = useState<ServerWallet[]>([]);
  const [evmDetected, setEvmDetected] = useState(false);
  const [solanaDetected, setSolanaDetected] = useState(false);
  const [busy, setBusy] = useState<"ethereum" | "solana" | "watch" | null>(null);
  const [watchChain, setWatchChain] = useState<"ethereum" | "solana">("ethereum");
  const [watchAddress, setWatchAddress] = useState("");
  const [watchLabel, setWatchLabel] = useState("");

  const reload = useCallback(async () => {
    if (!user) { setWallets([]); return; }
    try { setWallets((await listServerWallets()).wallets); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load your wallets."); }
  }, [user]);

  useEffect(() => {
    void reload();
    setEvmDetected(Boolean(getEvmProvider()));
    setSolanaDetected(Boolean(getSolanaProvider()));
    const ethereum = getEvmProvider();
    const onAccountsChanged = () => void reload();
    const onChainChanged = () => void reload();
    ethereum?.on?.("accountsChanged", onAccountsChanged);
    ethereum?.on?.("chainChanged", onChainChanged);
    return () => {
      ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
      ethereum?.removeListener?.("chainChanged", onChainChanged);
    };
  }, [reload]);

  const connect = async (chain: "ethereum" | "solana") => {
    setBusy(chain);
    try {
      let address: string;
      let chainId: string | undefined;
      let providerName: string;
      if (!user) {
        const result = await signIn(chain);
        address = result.address;
        chainId = result.chainId;
        providerName = chain === "ethereum" ? "EVM browser wallet" : "Solana browser wallet";
      } else if (chain === "ethereum") {
        const connected = await connectEvmWallet();
        address = connected.address;
        chainId = connected.chainId;
        providerName = connected.provider;
      } else {
        const connected = await connectSolanaWallet();
        address = connected.address;
        providerName = connected.provider;
      }
      await saveConnectedWallet({ chainFamily: chain, address, supportedNetworks: chain === "ethereum" ? [chainId || "1"] : ["mainnet-beta"], provider: providerName, connectionId: chainId });
      await reload();
      toast.success(`${chain === "ethereum" ? "EVM" : "Solana"} wallet connected and synced.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wallet connection failed.");
    } finally { setBusy(null); }
  };

  const addWatchOnly = async () => {
    if (!watchAddress.trim()) { toast.error("Enter a public wallet address first."); return; }
    setBusy("watch");
    try {
      await saveWatchOnlyWallet({ chainFamily: watchChain, address: watchAddress.trim(), supportedNetworks: watchChain === "ethereum" ? ["1"] : ["mainnet-beta"], label: watchLabel.trim() || undefined });
      setWatchAddress("");
      setWatchLabel("");
      await reload();
      toast.success("Watch-only address added.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to add watch-only address."); }
    finally { setBusy(null); }
  };

  const disconnect = async (wallet: ServerWallet) => {
    try {
      await removeServerWallet(wallet._id);
      if (wallet.chainFamily === "solana") await getSolanaProvider()?.disconnect?.();
      await reload();
      toast.success("Wallet removed from this account.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to remove wallet."); }
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-primary/10 bg-primary/[0.03] p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/50 sm:text-sm">Wallet connections</p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">Connect and view</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-primary/60 sm:text-sm sm:leading-6">Connect a browser wallet or add a public address for watch-only monitoring. AvhiSafe requests only public addresses and never signs or sends transactions beyond the one-time login challenge.</p>
        </div>
        <WalletCards className="hidden size-7 shrink-0 text-primary/40 sm:block" />
      </div>

      {!user && <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-sm text-amber-800 dark:text-amber-200"><div className="flex items-center gap-2 font-semibold"><LogIn className="size-4" />Sign in with a wallet to sync connections.</div><p className="mt-1 text-xs opacity-80">The sign-in request is a message only; it does not create a blockchain transaction.</p></div>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Button onClick={() => void connect("ethereum")} disabled={busy !== null || signingIn !== null} className="w-full gap-2"><Link2 className="size-4 shrink-0" /><span className="truncate">{busy === "ethereum" || signingIn === "ethereum" ? "Signing in…" : "Connect MetaMask / EVM"}</span></Button>
        <Button onClick={() => void connect("solana")} disabled={busy !== null || signingIn !== null} variant="outline" className="w-full gap-2"><Link2 className="size-4 shrink-0" /><span className="truncate">{busy === "solana" || signingIn === "solana" ? "Signing in…" : "Connect Solana wallet"}</span></Button>
      </div>

      <div className="mt-4 flex flex-col gap-1 text-xs text-primary/50 sm:flex-row sm:gap-3"><span>{evmDetected ? "✓ EVM provider detected" : "✗ No EVM provider detected"}</span><span>{solanaDetected ? "✓ Solana provider detected" : "✗ No Solana provider detected"}</span></div>

      <div className="mt-6 rounded-xl border border-primary/10 bg-background/60 p-4">
        <div className="flex items-center gap-2 font-semibold"><Eye className="size-4" />Add watch-only address</div>
        <p className="mt-1 text-xs text-primary/55">Track a public address without connecting or authorizing a wallet provider.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[130px_1fr_180px_auto]"><select value={watchChain} onChange={(event) => setWatchChain(event.target.value as "ethereum" | "solana")} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="ethereum">Ethereum</option><option value="solana">Solana</option></select><Input value={watchAddress} onChange={(event) => setWatchAddress(event.target.value)} placeholder={watchChain === "ethereum" ? "0x public address" : "Solana public address"} /><Input value={watchLabel} onChange={(event) => setWatchLabel(event.target.value)} placeholder="Label (optional)" /><Button onClick={() => void addWatchOnly()} disabled={busy !== null || !user}>{busy === "watch" ? "Adding…" : "Add address"}</Button></div>
      </div>

      {wallets.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">{wallets.map((wallet) => <div key={wallet._id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-background/70 p-3 sm:gap-3 sm:p-4"><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-primary/50">{wallet.chainFamily === "ethereum" ? "EVM" : "Solana"} · {wallet.sourceType === "watch_only" ? "Watch only" : wallet.provider || "Connected wallet"}</p><p className="mt-1 truncate font-mono text-xs sm:text-sm">{shortAddress(wallet.address)}</p><p className={`mt-1 text-xs ${wallet.sourceType === "watch_only" ? "text-amber-600" : "text-emerald-600"}`}>{wallet.sourceType === "watch_only" ? "Public address monitoring" : "Connected for read-only viewing"}</p></div><Button variant="ghost" size="icon" className="shrink-0" onClick={() => void disconnect(wallet)} aria-label={`Remove ${wallet.chainFamily} wallet`}><LogOut className="size-4" /></Button></div>)}</div>}
    </section>
  );
}
