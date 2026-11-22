"use client";

import { useState } from "react";
import { Eye, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useAuth } from "./AuthProvider";
import { saveWatchOnlyWallet } from "@/lib/walletApi";
import { validateAddress } from "@/lib/portfolio";

export default function WatchOnlyDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [chain, setChain] = useState<"ethereum" | "solana">("ethereum");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const addAddress = async () => {
    const trimmed = address.trim();
    if (!user) { toast.error("Sign in with a wallet before adding a watch-only address."); return; }
    if (!trimmed || !validateAddress(trimmed, chain)) {
      toast.error(`Enter a valid ${chain === "ethereum" ? "Ethereum" : "Solana"} public address.`);
      return;
    }
    setSaving(true);
    try {
      await saveWatchOnlyWallet({ chainFamily: chain, address: trimmed, supportedNetworks: chain === "ethereum" ? ["1"] : ["mainnet-beta"], label: label.trim() || undefined });
      setAddress("");
      setLabel("");
      setOpen(false);
      toast.success("Watch-only address added to your workspace.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add watch-only address.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2 rounded-full border-primary/20 bg-background/70 shadow-sm transition-transform hover:-translate-y-0.5">
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">Watch-only address</span>
          <span className="sm:hidden">Watch</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye className="size-5 text-primary" />Add watch-only address</DialogTitle>
          <DialogDescription>Track a public address without connecting or authorizing a wallet provider. Private keys and seed phrases are never requested.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <label className="text-sm font-semibold" htmlFor="watch-chain">Network</label>
            <select id="watch-chain" value={chain} onChange={(event) => setChain(event.target.value as "ethereum" | "solana")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="ethereum">Ethereum</option>
              <option value="solana">Solana</option>
            </select>
          </div>
          <div className="space-y-2"><label className="text-sm font-semibold" htmlFor="watch-address">Public address</label><Input id="watch-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder={chain === "ethereum" ? "0x public address" : "Solana public address"} autoFocus /></div>
          <div className="space-y-2"><label className="text-sm font-semibold" htmlFor="watch-label">Label <span className="font-normal text-primary/45">(optional)</span></label><Input id="watch-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Treasury, whale, cold storage…" /></div>
          <Button className="w-full gap-2" onClick={() => void addAddress()} disabled={saving || !user}>{saving ? <><Loader2 className="size-4 animate-spin" />Adding…</> : <><Plus className="size-4" />Add address</>}</Button>
          {!user && <p className="text-center text-xs text-amber-600">Sign in from the top bar to save watch-only addresses.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
