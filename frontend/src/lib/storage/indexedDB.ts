/**
 * IndexedDB Storage Layer for Encrypted Wallets
 *
 * This module provides persistent storage for encrypted wallet data.
 * All sensitive data (mnemonics) is encrypted BEFORE being stored here.
 *
 * Security Note: This layer only stores encrypted data. The plaintext
 * mnemonic never touches IndexedDB - encryption happens in the crypto layer.
 */

// Database configuration constants
const DB_NAME = "crypto-wallet";
const DB_VERSION = 1; // Increment this when schema changes (triggers onupgradeneeded)
const STORE_WALLETS = "wallets";

/**
 * Structure of a wallet stored in IndexedDB
 *
 * Note: encryptedMnemonic contains the AES-256-GCM encrypted seed phrase.
 * The actual mnemonic is never stored in plaintext.
 */
export interface StoredWallet {
  id: string; // UUID - primary key for the object store
  name: string; // User-friendly name (e.g., "My Main Wallet")
  encryptedMnemonic: {
    // Output from Task 1's encrypt() function
    ciphertext: Uint8Array; // The encrypted mnemonic
    salt: Uint8Array; // Random salt used for Argon2 key derivation
    nonce: Uint8Array; // Random nonce used for AES-GCM
  };
  createdAt: number; // Unix timestamp (milliseconds)
  addresses: {
    // Derived public addresses (safe to store - not sensitive)
    ethereum?: string;
    solana?: string;
    bitcoin?: string;
  };
}

/**
 * Opens (or creates) the IndexedDB database
 *
 * This wraps IndexedDB's callback-based API in a Promise for cleaner async/await usage.
 *
 * @returns Promise that resolves to the database connection
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Request to open database with specified name and version
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Called when database opens successfully
    request.onsuccess = () => {
      resolve(request.result); // request.result is the IDBDatabase
    };

    // Called if there's an error opening the database
    request.onerror = () => {
      reject(request.error);
    };

    // Called when database is created OR version number increases
    // This is the ONLY place where you can modify the database schema
    request.onupgradeneeded = () => {
      const db = request.result;
      // Create the wallets store if it doesn't exist
      // keyPath: "id" means the 'id' field is used as the primary key
      if (!db.objectStoreNames.contains(STORE_WALLETS)) {
        db.createObjectStore(STORE_WALLETS, { keyPath: "id" });
      }
    };
  });
}

/**
 * Saves a wallet to IndexedDB
 *
 * Uses put() which creates a new record or updates an existing one
 * if a wallet with the same id already exists.
 *
 * @param wallet - The encrypted wallet data to save
 */
export async function saveWallet(wallet: StoredWallet): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    // Create a transaction - all IndexedDB operations must happen within a transaction
    // "readwrite" allows both reading and modifying data
    const transaction = db.transaction(STORE_WALLETS, "readwrite");
    const store = transaction.objectStore(STORE_WALLETS);

    // put() inserts or updates based on the keyPath (id)
    const request = store.put(wallet);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };

    // Clean up: close database connection when transaction completes
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Retrieves a wallet by ID from IndexedDB
 *
 * @param id - The wallet's UUID
 * @returns The wallet if found, undefined if not found
 */
export async function getWallet(id: string): Promise<StoredWallet | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    // "readonly" since we're only reading, not modifying
    const transaction = db.transaction(STORE_WALLETS, "readonly");
    const store = transaction.objectStore(STORE_WALLETS);

    // get() retrieves a single record by its key (id)
    const request = store.get(id);

    request.onsuccess = () => {
      // request.result is the wallet object, or undefined if not found
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Retrieves all wallets from IndexedDB
 *
 * Used to populate the wallet list on app startup.
 *
 * @returns Array of all stored wallets (empty array if none exist)
 */
export async function getAllWallets(): Promise<StoredWallet[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_WALLETS, "readonly");
    const store = transaction.objectStore(STORE_WALLETS);

    // getAll() retrieves all records from the object store
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result); // Array of wallets
    };

    request.onerror = () => {
      reject(request.error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Deletes a wallet from IndexedDB
 *
 * Warning: This permanently removes the encrypted wallet data.
 * Users should be prompted to confirm and reminded to backup their mnemonic.
 *
 * @param id - The wallet's UUID to delete
 */
export async function deleteWallet(id: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    // "readwrite" required for delete operations
    const transaction = db.transaction(STORE_WALLETS, "readwrite");
    const store = transaction.objectStore(STORE_WALLETS);

    // delete() removes the record with the specified key
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}
