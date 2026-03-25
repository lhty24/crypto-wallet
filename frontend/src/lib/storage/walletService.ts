/**
 * Wallet Service - Central orchestrator for wallet operations
 *
 * This service bridges:
 * - Crypto layer (mnemonic generation, encryption, key derivation)
 * - Storage layer (IndexedDB persistence)
 * - State layer (Zustand store)
 *
 * All wallet operations (create, unlock, lock, delete) go through here.
 *
 * Security Note: Decrypted mnemonics and private keys are held in memory
 * only while the wallet is unlocked. On lock, they are zeroed out.
 */

import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
} from "../crypto/mnemonic";
import { encrypt, decrypt } from "../crypto/encryption";
import {
  deriveEthereumAddress,
  deriveBitcoinAddress,
  deriveSolanaAddress,
} from "../crypto/hdwallet";
import { zeroBuffer } from "../crypto/secureMemory";
import {
  saveWallet,
  getWallet,
  getAllWallets,
  deleteWallet as deleteStoredWallet,
  StoredWallet,
} from "./indexedDB";
import { startAutoLock, stopAutoLock, resetActivity } from "./sessionManager";
import { useWalletStore } from "../stores/walletStore";
import type { Account } from "../types/wallet";
import * as walletApi from "../api/wallets";

// Auto-lock timeout: 5 minutes
const AUTO_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Builds Account[] from StoredWallet.addresses
 *
 * Maps the public addresses stored in IndexedDB into Account objects
 * for use in the Zustand store. No re-derivation needed.
 */
function buildAccountsFromAddresses(addresses: StoredWallet["addresses"]): Account[] {
  const accounts: Account[] = [];
  if (addresses.ethereum) {
    accounts.push({
      id: "eth-0",
      name: "Ethereum Account",
      address: addresses.ethereum,
      chain: "Ethereum",
      derivationPath: "m/44'/60'/0'/0/0",
      accountIndex: 0,
    });
  }
  if (addresses.bitcoin) {
    accounts.push({
      id: "btc-0",
      name: "Bitcoin Account",
      address: addresses.bitcoin,
      chain: "Bitcoin",
      derivationPath: "m/44'/0'/0'/0/0",
      accountIndex: 0,
    });
  }
  if (addresses.solana) {
    accounts.push({
      id: "sol-0",
      name: "Solana Account",
      address: addresses.solana,
      chain: "Solana",
      derivationPath: "m/44'/501'/0'/0'",
      accountIndex: 0,
    });
  }
  return accounts;
}

// In-memory storage for sensitive data (cleared on lock)
let decryptedMnemonic: string | null = null;
let derivedSeed: Uint8Array | null = null;

/**
 * Generates a UUID for wallet IDs
 *
 * Uses crypto.randomUUID() which is cryptographically secure.
 */
function generateWalletId(): string {
  return crypto.randomUUID();
}

/**
 * Creates a new wallet with a fresh mnemonic
 *
 * Flow:
 * 1. Generate new mnemonic (BIP39)
 * 2. Derive addresses for all supported chains
 * 3. Encrypt mnemonic with user's password
 * 4. Save encrypted wallet to IndexedDB
 * 5. Update Zustand state
 *
 * @param name - User-friendly wallet name
 * @param password - Password for encrypting the mnemonic
 * @returns The wallet ID and mnemonic (user MUST back up the mnemonic!)
 */
export async function createWallet(
  name: string,
  password: string
): Promise<{ id: string; mnemonic: string }> {
  // 1. Generate new mnemonic
  const mnemonic = generateMnemonic();

  // 2. Derive seed and addresses
  const seed = mnemonicToSeed(mnemonic);
  const ethAddress = deriveEthereumAddress(seed);
  const btcAddress = deriveBitcoinAddress(seed);
  const solAddress = deriveSolanaAddress(seed);

  // 3. Encrypt mnemonic
  const encryptedData = await encrypt(mnemonic, password);

  // 4. Register wallet metadata with backend (must succeed before local save)
  const apiResult = await walletApi.createWallet({ name });
  if (!apiResult.success) {
    zeroBuffer(seed);
    throw new Error(`Failed to register wallet with backend: ${apiResult.error}`);
  }
  const walletId = apiResult.data.wallet_id;

  // 5. Save to IndexedDB using backend's wallet ID
  const storedWallet: StoredWallet = {
    id: walletId,
    name,
    encryptedMnemonic: encryptedData,
    createdAt: Date.now(),
    addresses: {
      ethereum: ethAddress.address,
      bitcoin: btcAddress.address,
      solana: solAddress.address,
    },
  };

  await saveWallet(storedWallet);

  // 6. Update Zustand state
  const { actions } = useWalletStore.getState();
  actions.setWallet({
    id: walletId,
    name,
    isLocked: true, // New wallet starts locked until user unlocks
    accounts: [],
    createdAt: new Date(storedWallet.createdAt).toISOString(),
  });

  // Clean up seed from memory (mnemonic returned to user for backup)
  zeroBuffer(seed);

  return { id: walletId, mnemonic };
}

/**
 * Imports an existing wallet from a mnemonic phrase
 *
 * @param name - User-friendly wallet name
 * @param mnemonic - The 12 or 24 word seed phrase
 * @param password - Password for encrypting the mnemonic
 * @returns The wallet ID
 * @throws Error if mnemonic is invalid
 */
export async function importWallet(
  name: string,
  mnemonic: string,
  password: string
): Promise<{ id: string }> {
  // Validate mnemonic first
  if (!validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic phrase");
  }

  // Derive seed and addresses
  const seed = mnemonicToSeed(mnemonic);
  const ethAddress = deriveEthereumAddress(seed);
  const btcAddress = deriveBitcoinAddress(seed);
  const solAddress = deriveSolanaAddress(seed);

  // Encrypt mnemonic
  const encryptedData = await encrypt(mnemonic, password);

  // Register imported wallet metadata with backend (must succeed before local save)
  const apiResult = await walletApi.importWallet({ name });
  if (!apiResult.success) {
    zeroBuffer(seed);
    throw new Error(`Failed to register wallet with backend: ${apiResult.error}`);
  }
  const walletId = apiResult.data.wallet_id;

  // Save to IndexedDB using backend's wallet ID
  const storedWallet: StoredWallet = {
    id: walletId,
    name,
    encryptedMnemonic: encryptedData,
    createdAt: Date.now(),
    addresses: {
      ethereum: ethAddress.address,
      bitcoin: btcAddress.address,
      solana: solAddress.address,
    },
  };

  await saveWallet(storedWallet);

  // Update Zustand state
  const { actions } = useWalletStore.getState();
  actions.setWallet({
    id: walletId,
    name,
    isLocked: true, // Imported wallet starts locked until user unlocks
    accounts: [],
    createdAt: new Date(storedWallet.createdAt).toISOString(),
  });

  // Clean up
  zeroBuffer(seed);

  return { id: walletId };
}

/**
 * Registers wallet addresses with the backend for balance indexing.
 *
 * Best-effort: logs warnings on failure but never throws.
 * Sets addressesRegistered flag in IndexedDB on full success.
 */
async function registerAddressesWithBackend(
  storedWallet: StoredWallet
): Promise<string | null> {
  const addressEntries: { address: string; chain: string; derivation_path: string }[] = [];

  if (storedWallet.addresses.ethereum) {
    addressEntries.push({
      address: storedWallet.addresses.ethereum,
      chain: "ethereum",
      derivation_path: "m/44'/60'/0'/0/0",
    });
  }
  if (storedWallet.addresses.bitcoin) {
    addressEntries.push({
      address: storedWallet.addresses.bitcoin,
      chain: "bitcoin",
      derivation_path: "m/44'/0'/0'/0/0",
    });
  }
  if (storedWallet.addresses.solana) {
    addressEntries.push({
      address: storedWallet.addresses.solana,
      chain: "solana",
      derivation_path: "m/44'/501'/0'/0'",
    });
  }

  let allSucceeded = true;
  for (const entry of addressEntries) {
    try {
      const result = await walletApi.registerAddress(storedWallet.id, entry);
      if (!result.success) {
        allSucceeded = false;
        console.warn(`Failed to register ${entry.chain} address: ${result.error}`);
      }
    } catch (err) {
      allSucceeded = false;
      console.warn(`Failed to register ${entry.chain} address:`, err);
    }
  }

  if (allSucceeded) {
    // Mark addresses as registered so we don't re-register on next unlock
    await saveWallet({ ...storedWallet, addressesRegistered: true });
    return null;
  }

  return "Could not sync addresses with server — balances may be unavailable. Will retry on next unlock.";
}

/**
 * Unlocks a wallet by decrypting its mnemonic
 *
 * Flow:
 * 1. Get encrypted wallet from IndexedDB
 * 2. Decrypt mnemonic with password
 * 3. Derive seed (kept in memory for signing)
 * 4. Start auto-lock timer
 * 5. Update Zustand state to "unlocked"
 *
 * @param walletId - The wallet's UUID
 * @param password - Password to decrypt the mnemonic
 * @throws Error if wallet not found or password incorrect
 */
export async function unlockWallet(
  walletId: string,
  password: string
): Promise<void> {
  // 1. Get wallet from IndexedDB
  const storedWallet = await getWallet(walletId);
  if (!storedWallet) {
    throw new Error("Wallet not found");
  }

  // 2. Decrypt mnemonic (throws if password wrong)
  try {
    decryptedMnemonic = await decrypt(storedWallet.encryptedMnemonic, password);
  } catch {
    throw new Error("Incorrect password");
  }

  // 3. Derive seed for future signing operations
  derivedSeed = mnemonicToSeed(decryptedMnemonic);

  // 4. Start auto-lock timer
  startAutoLock(AUTO_LOCK_TIMEOUT_MS, lockWallet);

  // 5. Update Zustand state
  const { actions } = useWalletStore.getState();
  actions.setWallet({
    id: storedWallet.id,
    name: storedWallet.name,
    isLocked: false,
    accounts: buildAccountsFromAddresses(storedWallet.addresses),
    createdAt: new Date(storedWallet.createdAt).toISOString(),
  });
  actions.unlockWallet();

  // 6. Register addresses with backend (best-effort, retries on next unlock)
  if (!storedWallet.addressesRegistered) {
    const warning = await registerAddressesWithBackend(storedWallet);
    if (warning) {
      actions.setWarning(warning);
    }
  }
}

/**
 * Locks the wallet, clearing sensitive data from memory
 *
 * This is called:
 * - Manually by user clicking "Lock"
 * - Automatically by the session manager after timeout
 */
export function lockWallet(): void {
  // Clear sensitive data from memory
  if (derivedSeed) {
    zeroBuffer(derivedSeed);
    derivedSeed = null;
  }
  decryptedMnemonic = null;

  // Stop the auto-lock timer
  stopAutoLock();

  // Update Zustand state
  const { actions } = useWalletStore.getState();
  actions.lockWallet();
}

/**
 * Resets activity timer (call on user interaction)
 *
 * Re-export from sessionManager for convenience.
 * Call this from UI event handlers to prevent auto-lock during activity.
 */
export { resetActivity };

/**
 * Loads all wallets from IndexedDB (for app startup)
 *
 * This populates the wallet list but does NOT unlock any wallet.
 * User must enter password to unlock.
 *
 * @returns Array of wallet metadata (without sensitive data)
 */
export async function loadWallets(): Promise<StoredWallet[]> {
  const wallets = await getAllWallets();
  return wallets;
}

/**
 * Deletes a wallet permanently
 *
 * WARNING: This is irreversible! User should confirm they have
 * backed up their mnemonic before calling this.
 *
 * @param walletId - The wallet's UUID
 */
export async function deleteWalletById(walletId: string): Promise<void> {
  // If this is the currently unlocked wallet, lock first
  const state = useWalletStore.getState();
  if (state.currentWallet?.id === walletId && state.isUnlocked) {
    lockWallet();
  }

  // Delete from backend (best-effort — local deletion should always proceed)
  try {
    const result = await walletApi.deleteWallet(walletId);
    if (!result.success) {
      console.warn(`Failed to delete wallet from backend: ${result.error}`);
    }
  } catch (err) {
    console.warn("Failed to delete wallet from backend:", err);
  }

  // Delete from IndexedDB
  await deleteStoredWallet(walletId);

  // Clear from Zustand if it was the current wallet
  if (state.currentWallet?.id === walletId) {
    const { actions } = useWalletStore.getState();
    actions.clearWallet();
  }
}

/**
 * Checks if a wallet is currently unlocked
 */
export function isWalletUnlocked(): boolean {
  return useWalletStore.getState().isUnlocked;
}

/**
 * Gets the current wallet ID if one is selected
 */
export function getCurrentWalletId(): string | null {
  return useWalletStore.getState().currentWallet?.id ?? null;
}
