"use client";

import { useRef, useState } from "react";
import { LockKeyhole, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useVault } from "./VaultProvider";

export default function VaultGate({ children }: { children: React.ReactNode }) {
  const { locked, configured, create, unlock, restore } = useVault();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!locked) return <>{children}</>;

  const submit = async () => {
    if (password.length < 10) return toast.error("Use at least 10 characters.");
    if (!configured && password !== confirm) return toast.error("Passwords do not match.");
    await (configured ? unlock(password) : create(password));
    setPassword(""); setConfirm("");
  };

  const handleRestore = async (file: File) => {
    if (!password) return toast.error("Enter the backup password first.");
    await restore(file, password);
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-primary/10 bg-background p-8 shadow-2xl"><div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-primary p-3 text-primary-foreground"><LockKeyhole className="size-6" /></div><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary/50">AvhiSafe vault</p><h1 className="text-3xl font-black tracking-tight">{configured ? "Unlock your vault" : "Protect your wallet"}</h1></div></div><p className="mb-6 text-sm leading-6 text-primary/70">Your wallet secrets are encrypted locally with AES-GCM. AvhiSafe cannot recover a forgotten password. Do not use a password you share with other services.</p><div className="flex flex-col gap-3"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Vault password" autoFocus />{!configured && <Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Confirm password" />}</div><Button className="mt-4 w-full" onClick={submit}>{configured ? "Unlock vault" : "Create encrypted vault"}</Button>{configured && <><div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-primary/40"><span className="h-px flex-1 bg-primary/10" />or<span className="h-px flex-1 bg-primary/10" /></div><Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}><Upload className="size-4" />Restore encrypted backup</Button><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(event) => event.target.files?.[0] && handleRestore(event.target.files[0])} /></>}<div className="mt-6 flex gap-2 rounded-xl bg-primary/5 p-3 text-xs text-primary/60"><ShieldCheck className="size-4 shrink-0" />No transaction signing is enabled. The portfolio remains read-only.</div></div></div>;
}
