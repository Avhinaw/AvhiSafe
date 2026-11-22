"use client";

import { useEffect, useState } from "react";
import { Download, Lock, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAccount as deleteAccountApi, downloadAccountExport } from "@/lib/authApi";
import { useVault } from "./VaultProvider";
import { Button } from "./ui/button";

type SecurityAlert = { _id: string; severity: "low" | "medium" | "high" | "critical"; title: string; explanation: string; status: string; source: string; evidence: Array<{ description: string; source?: string }> };
type SecurityScan = { _id: string; status: string; scanType: string; checksRun: number; alertsCreated: number; completedAt?: string };

export default function SecurityCenter() {
  const { lock, backup, wallets } = useVault();
  const [showGuide, setShowGuide] = useState(false);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [latestScan, setLatestScan] = useState<SecurityScan | null>(null);
  const [scanning, setScanning] = useState(false);

  const loadSecurity = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "https://avhisafe-backend.onrender.com"}/api/v1/security/alerts`, { credentials: "include" });
      if (response.ok) setAlerts((await response.json() as { alerts: SecurityAlert[] }).alerts);
      const scansResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "https://avhisafe-backend.onrender.com"}/api/v1/security/scans`, { credentials: "include" });
      if (scansResponse.ok) setLatestScan((await scansResponse.json() as { scans: SecurityScan[] }).scans[0] || null);
    } catch { /* The dashboard remains usable when security history is unavailable. */ }
  };

  useEffect(() => { void loadSecurity(); }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "https://avhisafe-backend.onrender.com"}/api/v1/security/scan`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scanType: "baseline" }) });
      const body = await response.json() as { error?: string; scan?: SecurityScan; alerts?: SecurityAlert[] };
      if (!response.ok) throw new Error(body.error || "Security scan failed.");
      setLatestScan(body.scan || null);
      setAlerts(body.alerts || []);
      toast.success("Deterministic baseline scan completed.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Security scan failed."); }
    finally { setScanning(false); }
  };

  const exportBackup = () => { try { backup(); toast.success("Encrypted backup downloaded."); } catch (error) { toast.error(error instanceof Error ? error.message : "Backup unavailable."); } };
  const exportAccount = async () => { try { await downloadAccountExport(); toast.success("Account export downloaded."); } catch (error) { toast.error(error instanceof Error ? error.message : "Account export unavailable."); } };
  const removeAccount = async () => {
    if (!window.confirm("Delete this AvhiSafe account and all server-side wallet, dashboard, history, and vault-backup data? This cannot be undone.")) return;
    try { await deleteAccountApi(); toast.success("Account deleted."); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Account deletion failed."); }
  };

  return <section className="mt-12 rounded-2xl border border-primary/10 bg-primary/[0.03] p-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600"><ShieldCheck className="size-6" /></div><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary/50">Security center</p><h2 className="text-2xl font-black">Evidence-aware protection</h2><p className="text-sm text-primary/60">{wallets.length} wallet record{wallets.length === 1 ? "" : "s"} protected locally. No transaction signing is enabled.</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="gap-2" onClick={runScan} disabled={scanning}><RefreshCw className={scanning ? "size-4 animate-spin" : "size-4"} />{scanning ? "Scanning…" : "Run baseline scan"}</Button><Button variant="outline" className="gap-2" onClick={exportBackup}><Download className="size-4" />Encrypted backup</Button><Button variant="outline" className="gap-2" onClick={lock}><Lock className="size-4" />Lock now</Button></div></div>
    <div className="mt-5 rounded-xl border border-primary/10 bg-background/70 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>Latest deterministic scan</strong><span className="text-primary/55">{latestScan ? `${latestScan.status} · ${latestScan.checksRun} checks · ${latestScan.alertsCreated} alerts` : "Not run yet"}</span></div><p className="mt-2 text-xs text-primary/55">Scans currently report AvhiSafe policy-boundary evidence only. They do not make claims about malicious contracts, approvals, or investment safety.</p></div>
    {alerts.length > 0 && <div className="mt-4 space-y-2">{alerts.map((alert) => <div key={alert._id} className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm"><strong>{alert.title}</strong><p className="mt-1 text-primary/65">{alert.explanation}</p><p className="mt-2 text-xs text-primary/45">Severity: {alert.severity} · Source: {alert.source}</p></div>)}</div>}
    <button className="mt-5 text-sm font-bold text-primary/60 underline-offset-4 hover:underline" onClick={() => setShowGuide(!showGuide)}>{showGuide ? "Hide" : "Show"} security checklist</button>{showGuide && <div className="mt-4 grid gap-3 text-sm text-primary/70 md:grid-cols-2"><p className="rounded-lg bg-background/70 p-3">Never share a recovery phrase or private key. AvhiSafe will never ask you to send one.</p><p className="rounded-lg bg-background/70 p-3">Keep the encrypted backup offline and protect the vault password separately.</p><p className="rounded-lg bg-background/70 p-3">The portfolio is read-only. Review every address on an independent explorer.</p><p className="rounded-lg bg-background/70 p-3">A forgotten vault password cannot be recovered by this application.</p></div>}
    <div className="mt-6 flex flex-wrap gap-2 border-t border-primary/10 pt-5"><Button variant="outline" onClick={exportAccount}><Download className="mr-2 size-4" />Export account data</Button><Button variant="outline" className="text-destructive hover:text-destructive" onClick={removeAccount}><Trash2 className="mr-2 size-4" />Delete account</Button></div>
  </section>;
}
