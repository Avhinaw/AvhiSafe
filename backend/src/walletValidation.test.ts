import assert from "node:assert/strict";
import bs58 from "bs58";
import { displayWalletAddress, normalizeWalletAddress } from "./walletValidation.js";

const ethereumInput = "0x000000000000000000000000000000000000dEaD";
assert.equal(normalizeWalletAddress("ethereum", ethereumInput), "0x000000000000000000000000000000000000dead");
assert.equal(displayWalletAddress("ethereum", normalizeWalletAddress("ethereum", ethereumInput)), "0x000000000000000000000000000000000000dEaD");
assert.throws(() => normalizeWalletAddress("ethereum", "0xnot-an-address"), /invalid address/i);

const solanaInput = bs58.encode(new Uint8Array(32).fill(7));
assert.equal(normalizeWalletAddress("solana", solanaInput), solanaInput);
assert.throws(() => normalizeWalletAddress("solana", bs58.encode(new Uint8Array(31))), /Invalid Solana address/);

console.log("AvhiSafe wallet validation tests passed.");
