"use client";

import { Box, LogIn, LogOut, Loader2, ShieldCheck } from "lucide-react";
import React from "react";
import { ModeToggle } from "./ui/theme-button";
import { Button } from "./ui/button";
import { useAuth } from "./AuthProvider";
import WatchOnlyDialog from "./WatchOnlyDialog";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const Navbar = () => {
  const { user, loading, signingIn, signIn, logout } = useAuth();

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4">
      <div className="flex items-center gap-2">
        <Box className="size-8" />
        <div className="flex flex-col gap-4">
          <span className="flex items-center gap-2 text-2xl font-extrabold tracking-tighter text-primary sm:text-3xl">
          AvhiSafe{" "}
            <span className="rounded-full text-base bg-primary/10 border border-primary/50 px-2">
              v1.0
            </span>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <WatchOnlyDialog />
        {loading ? <Loader2 className="size-4 animate-spin text-primary/50" /> : user ? (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs">
            <ShieldCheck className="size-4 text-emerald-600" />
            <span className="max-w-28 truncate font-mono">{shortAddress(user.primaryWalletAddress || user._id)}</span>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => void logout()} aria-label="Sign out">
              <LogOut className="size-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={signingIn !== null} onClick={() => void signIn("ethereum")}>
              {signingIn === "ethereum" ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />}
              EVM sign in
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={signingIn !== null} onClick={() => void signIn("solana")}>
              {signingIn === "solana" ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />}
              Solana sign in
            </Button>
          </>
        )}
        <ModeToggle />
      </div>
    </nav>
  );
};

export default Navbar;
