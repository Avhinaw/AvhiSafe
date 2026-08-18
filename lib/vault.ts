export const VAULT_STORAGE_KEY = "avhisafe.encryptedVault.v1";
export const VAULT_INDEX_KEY = "avhisafe.publicIndex.v1";

export interface VaultWallet {
  publicKey: string;
  privateKey: string;
  mnemonic: string;
  path: string;
  label?: string;
}

export interface PublicWalletIndex {
  publicKey: string;
  path: string;
  label?: string;
}

interface EncryptedVault {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function hasVault() {
  return typeof window !== "undefined" && Boolean(localStorage.getItem(VAULT_STORAGE_KEY));
}

export async function encryptVault(wallets: VaultWallet[], password: string): Promise<EncryptedVault> {
  if (password.length < 10) throw new Error("Password must contain at least 10 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(wallets)));
  return { version: 1, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

export async function decryptVault(payload: EncryptedVault, password: string): Promise<VaultWallet[]> {
  const key = await deriveKey(password, base64ToBytes(payload.salt));
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(payload.iv) }, key, base64ToBytes(payload.ciphertext));
  const value = JSON.parse(decoder.decode(plaintext));
  if (!Array.isArray(value)) throw new Error("Invalid vault contents.");
  return value as VaultWallet[];
}

export function publicIndexFor(wallets: VaultWallet[]): PublicWalletIndex[] {
  return wallets.map(({ publicKey, path, label }) => ({ publicKey, path, label }));
}

export function savePublicIndex(wallets: VaultWallet[]) {
  localStorage.setItem(VAULT_INDEX_KEY, JSON.stringify(publicIndexFor(wallets)));
}

export function readPublicIndex(): PublicWalletIndex[] {
  try { return JSON.parse(localStorage.getItem(VAULT_INDEX_KEY) || "[]") as PublicWalletIndex[]; } catch { return []; }
}

export async function saveEncryptedWallets(wallets: VaultWallet[], password: string) {
  const payload = await encryptVault(wallets, password);
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(payload));
  savePublicIndex(wallets);
}

export async function loadEncryptedWallets(password: string) {
  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return [];
  return decryptVault(JSON.parse(raw) as EncryptedVault, password);
}

export function downloadBackup() {
  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) throw new Error("No encrypted vault exists yet.");
  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `avhisafe-encrypted-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function restoreBackup(raw: string, password: string) {
  const payload = JSON.parse(raw) as EncryptedVault;
  const wallets = await decryptVault(payload, password);
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(payload));
  savePublicIndex(wallets);
  return wallets;
}
