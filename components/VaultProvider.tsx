"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { decryptVault, downloadBackup, encryptVault, hasVault, loadEncryptedWallets, restoreBackup, saveEncryptedWallets, savePublicIndex, VaultWallet, type EncryptedVault } from "@/lib/vault";
import { loadRemoteVault, saveRemoteVault } from "@/lib/vaultApi";
import { useAuth } from "./AuthProvider";

interface VaultContextValue {
  wallets: VaultWallet[];
  locked: boolean;
  configured: boolean;
  unlock: (password: string) => Promise<boolean>;
  create: (password: string) => Promise<boolean>;
  persist: (wallets: VaultWallet[], password?: string) => Promise<boolean>;
  lock: () => void;
  backup: () => void;
  restore: (file: File, password: string) => Promise<boolean>;
  remoteBackupAvailable: boolean;
  restoreRemote: (password: string) => Promise<boolean>;
}

const VaultContext = createContext<VaultContextValue | null>(null);
const IDLE_TIMEOUT = 15 * 60 * 1000;

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<VaultWallet[]>([]);
  const [locked, setLocked] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [sessionPassword, setSessionPassword] = useState("");
  const [remoteVault, setRemoteVault] = useState<(EncryptedVault & { updatedAt?: string }) | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) { setRemoteVault(null); return; }
    void loadRemoteVault().then((result) => setRemoteVault(result.vault)).catch(() => setRemoteVault(null));
  }, [user]);

  const syncRemote = useCallback(async (next: VaultWallet[], password: string) => {
    if (!user || !password) return;
    try { const encrypted = await encryptVault(next, password); await saveRemoteVault(encrypted); setRemoteVault({ ...encrypted, updatedAt: new Date().toISOString() }); } catch { toast.error("Local vault saved, but account backup sync failed."); }
  }, [user]);

  useEffect(() => {
    if (user && sessionPassword) void syncRemote(wallets, sessionPassword);
  }, [user, sessionPassword, syncRemote, wallets]);

  useEffect(() => {
    const exists = hasVault();
    setConfigured(exists);
    setLocked(exists);
    if (!exists) {
      const legacy = localStorage.getItem("wallets");
      if (legacy) toast.warning("Legacy wallet data detected. Create a vault and migrate it immediately.");
    }
  }, []);

  const lock = useCallback(() => {
    setWallets([]);
    setSessionPassword("");
    if (configured) setLocked(true);
  }, [configured]);

  useEffect(() => {
    if (!sessionPassword) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(timer); timer = setTimeout(lock, IDLE_TIMEOUT); };
    ["pointerdown", "keydown", "touchstart"].forEach((event) => window.addEventListener(event, reset));
    reset();
    return () => { clearTimeout(timer); ["pointerdown", "keydown", "touchstart"].forEach((event) => window.removeEventListener(event, reset)); };
  }, [sessionPassword, lock]);

  const unlock = useCallback(async (password: string) => {
    try {
      const next = await loadEncryptedWallets(password);
      await syncRemote(next, password);
      setWallets(next);
      setSessionPassword(password);
      setLocked(false);
      return true;
    } catch { toast.error("Incorrect password or corrupted vault."); return false; }
  }, [syncRemote]);

  const create = useCallback(async (password: string) => {
    try {
      let legacy: VaultWallet[] = [];
      try { legacy = JSON.parse(localStorage.getItem("wallets") || "[]") as VaultWallet[]; } catch { legacy = []; }
      await saveEncryptedWallets(legacy, password);
      localStorage.removeItem("wallets");
      localStorage.removeItem("mnemonics");
      await syncRemote(legacy, password); setConfigured(true); setLocked(false); setSessionPassword(password); setWallets(legacy); toast.success(legacy.length ? "Encrypted vault created and legacy wallets migrated." : "Encrypted vault created."); return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create vault."); return false; }
  }, [syncRemote]);

  const persist = useCallback(async (next: VaultWallet[], password = sessionPassword) => {
    if (!password) return false;
    try { await saveEncryptedWallets(next, password); await syncRemote(next, password); setWallets(next); return true; } catch { toast.error("Unable to save encrypted vault."); return false; }
  }, [sessionPassword, syncRemote]);

  const restore = useCallback(async (file: File, password: string) => {
    try { const next = await restoreBackup(await file.text(), password); await syncRemote(next, password); setWallets(next); setSessionPassword(password); setConfigured(true); setLocked(false); toast.success("Encrypted backup restored."); return true; } catch { toast.error("Backup or password is invalid."); return false; }
  }, [syncRemote]);

  const restoreRemote = useCallback(async (password: string) => {
    if (!remoteVault) return false;
    try { const next = await decryptVault(remoteVault, password); localStorage.setItem("avhisafe.encryptedVault.v1", JSON.stringify(remoteVault)); savePublicIndex(next); setWallets(next); setSessionPassword(password); setConfigured(true); setLocked(false); toast.success("Encrypted account vault restored."); return true; } catch { toast.error("Incorrect password or corrupted account backup."); return false; }
  }, [remoteVault]);

  const value = useMemo(() => ({ wallets, locked, configured, unlock, create, persist, lock, backup: downloadBackup, restore, remoteBackupAvailable: Boolean(remoteVault), restoreRemote }), [wallets, locked, configured, unlock, create, persist, lock, restore, remoteVault, restoreRemote]);
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) throw new Error("useVault must be used inside VaultProvider");
  return context;
}
