"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import bs58 from "bs58";
import { toast } from "sonner";
import { issueAuthNonce, loadCurrentUser, logoutApi, verifyAuthNonce, type AuthChain, type AuthUser, type WalletAuthResult } from "@/lib/authApi";
import { getEvmProvider, getSolanaProvider } from "@/lib/connectedWallet";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signingIn: AuthChain | null;
  signIn: (chain: AuthChain) => Promise<WalletAuthResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState<AuthChain | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await loadCurrentUser();
      setUser(result.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleSessionExpired = () => setUser(null);
    window.addEventListener("avhisafe:session-expired", handleSessionExpired);
    return () => window.removeEventListener("avhisafe:session-expired", handleSessionExpired);
  }, [refresh]);

  const signIn = useCallback(async (chain: AuthChain): Promise<WalletAuthResult> => {
    setSigningIn(chain);
    try {
      let address: string;
      let signature: string;
      let chainId: string | undefined;
      let messageBytes: Uint8Array;

      if (chain === "ethereum") {
        const provider = getEvmProvider();
        if (!provider) throw new Error("No browser EVM wallet detected. Install MetaMask or another EIP-1193 wallet.");
        const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
        if (!accounts?.[0]) throw new Error("The wallet did not return an account.");
        address = accounts[0];
        chainId = await provider.request({ method: "eth_chainId" }) as string;
        const challenge = await issueAuthNonce({ chainFamily: chain, address, chainId });
        signature = await provider.request({ method: "personal_sign", params: [challenge.message, address] }) as string;
        const result = await verifyAuthNonce({ nonceId: challenge.nonceId, address, signature, message: challenge.message });
        setUser(result.user);
        return { ...result, address, chainFamily: chain, chainId };
      }

      const provider = getSolanaProvider();
      if (!provider?.connect || !provider.signMessage) throw new Error("No Solana wallet with message signing detected. Install Phantom or another compatible wallet.");
      const connected = await provider.connect();
      address = connected.publicKey?.toString() || provider.publicKey?.toString() || "";
      if (!address) throw new Error("The Solana wallet did not return a public key.");
      const challenge = await issueAuthNonce({ chainFamily: chain, address, chainId: "mainnet-beta" });
      messageBytes = new TextEncoder().encode(challenge.message);
      const signed = await provider.signMessage(messageBytes, "utf8");
      const signatureBytes = signed instanceof Uint8Array ? signed : signed.signature;
      signature = bs58.encode(signatureBytes);
      const result = await verifyAuthNonce({ nonceId: challenge.nonceId, address, signature, message: challenge.message });
      setUser(result.user);
      return { ...result, address, chainFamily: chain, chainId: "mainnet-beta" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet sign-in failed.";
      toast.error(message);
      throw error;
    } finally {
      setSigningIn(null);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await logoutApi(); } catch { /* A missing session is already logged out. */ }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, signingIn, signIn, logout, refresh }), [user, loading, signingIn, signIn, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
