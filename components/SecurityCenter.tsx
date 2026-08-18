"use client";

import { useState } from "react";
import { Download, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useVault } from "./VaultProvider";

export default function SecurityCenter() {
  const { lock, backup, wallets } = useVault();
  const [showGuide, setShowGuide] = useState(false);
  const exportBackup = () => { try { backup(); toast.success("Encrypted backup downloaded."); } catch (error) { toast.error(error instanceof Error ? error.message : "Backup unavailable."); } };
  return <section className="mt-12 rounded-2xl border border-primary/10 bg-primary/[0.03] p-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600"><ShieldCheck className="size-6" /></div><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary/50">Security center</p><h2 className="text-2xl font-black">Encrypted vault active</h2><p className="text-sm text-primary/60">{wallets.length} wallet record{wallets.length === 1 ? "" : "s"} protected locally. Auto-lock is enabled after inactivity.</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="gap-2" onClick={exportBackup}><Download className="size-4" />Encrypted backup</Button><Button variant="outline" className="gap-2" onClick={lock}><Lock className="size-4" />Lock now</Button></div></div><button className="mt-5 text-sm font-bold text-primary/60 underline-offset-4 hover:underline" onClick={() => setShowGuide(!showGuide)}>{showGuide ? "Hide" : "Show"} security checklist</button>{showGuide && <div className="mt-4 grid gap-3 text-sm text-primary/70 md:grid-cols-2"><p className="rounded-lg bg-background/70 p-3">Never share a recovery phrase or private key. AvhiSafe will never ask you to send one.</p><p className="rounded-lg bg-background/70 p-3">Keep the encrypted backup offline and protect the vault password separately.</p><p className="rounded-lg bg-background/70 p-3">The portfolio is read-only. Review every address on an independent explorer.</p><p className="rounded-lg bg-background/70 p-3">A forgotten vault password cannot be recovered by this application.</p></div>}</section>;
}
