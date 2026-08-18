"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { downloadBackup, hasVault, loadEncryptedWallets, restoreBackup, saveEncryptedWallets, VaultWallet } from "@/lib/vault";

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
}

const VaultContext = createContext<VaultContextValue | null>(null);
const IDLE_TIMEOUT = 15 * 60 * 1000;

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<VaultWallet[]>([]);
  const [locked, setLocked] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [sessionPassword, setSessionPassword] = useState("");

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
      setWallets(next);
      setSessionPassword(password);
      setLocked(false);
      return true;
    } catch { toast.error("Incorrect password or corrupted vault."); return false; }
  }, []);

  const create = useCallback(async (password: string) => {
    try {
      let legacy: VaultWallet[] = [];
      try { legacy = JSON.parse(localStorage.getItem("wallets") || "[]") as VaultWallet[]; } catch { legacy = []; }
      await saveEncryptedWallets(legacy, password);
      localStorage.removeItem("wallets");
      localStorage.removeItem("mnemonics");
      setConfigured(true); setLocked(false); setSessionPassword(password); setWallets(legacy); toast.success(legacy.length ? "Encrypted vault created and legacy wallets migrated." : "Encrypted vault created."); return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create vault."); return false; }
  }, []);

  const persist = useCallback(async (next: VaultWallet[], password = sessionPassword) => {
    if (!password) return false;
    try { await saveEncryptedWallets(next, password); setWallets(next); return true; } catch { toast.error("Unable to save encrypted vault."); return false; }
  }, [sessionPassword]);

  const restore = useCallback(async (file: File, password: string) => {
    try { const next = await restoreBackup(await file.text(), password); setWallets(next); setSessionPassword(password); setConfigured(true); setLocked(false); toast.success("Encrypted backup restored."); return true; } catch { toast.error("Backup or password is invalid."); return false; }
  }, []);

  const value = useMemo(() => ({ wallets, locked, configured, unlock, create, persist, lock, backup: downloadBackup, restore }), [wallets, locked, configured, unlock, create, persist, lock, restore]);
  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) throw new Error("useVault must be used inside VaultProvider");
  return context;
}
