# P1-W2-FE-T2: Secure Local Storage Management

**Phase**: 1 - Foundation
**Week**: 2 - Basic Wallet Operations
**Task**: Frontend Task 2 - Build secure client-side storage management
**Date**: January 2026
**Status**: Completed

---

## Overview

Implemented secure client-side storage management for the non-custodial cryptocurrency wallet. This layer bridges the cryptographic functionality (Task 1) with persistent storage and application state management.

### Components Built

| Component | File | Purpose |
|-----------|------|---------|
| IndexedDB Storage | `indexedDB.ts` | Encrypted wallet persistence |
| Session Manager | `sessionManager.ts` | Auto-lock timer and activity tracking |
| Wallet Service | `walletService.ts` | Central orchestrator for all wallet operations |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     UI Components (Future)                       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      walletService.ts                            │
│  Central orchestrator bridging crypto, storage, and state        │
│  - createWallet(), importWallet()                                │
│  - unlockWallet(), lockWallet()                                  │
│  - loadWallets(), deleteWalletById()                             │
└─────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Crypto Layer │   │ Storage Layer │   │  State Layer  │
│  (Task 1)     │   │ indexedDB.ts  │   │ walletStore   │
│  - mnemonic   │   │  - saveWallet │   │  (Zustand)    │
│  - encrypt    │   │  - getWallet  │   │  - setWallet  │
│  - hdwallet   │   │  - delete     │   │  - lock/unlock│
└───────────────┘   └───────────────┘   └───────────────┘
                               │
                               ▼
                    ┌───────────────────┐
                    │  sessionManager   │
                    │  - Auto-lock timer│
                    │  - Activity reset │
                    └───────────────────┘
```

---

## Implementation Details

### 1. IndexedDB Storage Layer (`indexedDB.ts`)

**Purpose**: Persist encrypted wallet data in the browser using IndexedDB.

**Key Concepts**:
- **IndexedDB**: Browser API for large-scale structured data storage
- **Object Store**: NoSQL-style storage with key-value pairs
- **Transactions**: Atomic read/write operations
- **Why IndexedDB over localStorage**: Supports Uint8Array directly, larger storage limits

```typescript
const DB_NAME = "crypto-wallet";
const DB_VERSION = 1;
const WALLET_STORE = "wallets";

export interface StoredWallet {
  id: string;
  name: string;
  encryptedMnemonic: EncryptedData;  // From Task 1 encryption
  createdAt: number;
  addresses: {
    ethereum?: string;
    bitcoin?: string;
    solana?: string;
  };
}

export async function saveWallet(wallet: StoredWallet): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WALLET_STORE, "readwrite");
    const store = tx.objectStore(WALLET_STORE);
    const request = store.put(wallet);  // put = upsert behavior
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getWallet(id: string): Promise<StoredWallet | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WALLET_STORE, "readonly");
    const store = tx.objectStore(WALLET_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

**What Gets Stored**:
```
┌──────────────────────────────────────────────────────────┐
│  IndexedDB: "crypto-wallet" → "wallets" object store     │
├──────────────────────────────────────────────────────────┤
│  {                                                       │
│    id: "550e8400-e29b-41d4-a716-446655440000",          │
│    name: "My Main Wallet",                               │
│    encryptedMnemonic: {                                  │
│      ciphertext: Uint8Array(128),  // Encrypted mnemonic │
│      salt: Uint8Array(32),         // For Argon2         │
│      nonce: Uint8Array(12),        // For AES-GCM        │
│    },                                                    │
│    createdAt: 1706140800000,                            │
│    addresses: {                                          │
│      ethereum: "0x742d35Cc...",                         │
│      bitcoin: "1A1zP1eP5...",                           │
│      solana: "7EcDhSYGx...",                            │
│    }                                                     │
│  }                                                       │
└──────────────────────────────────────────────────────────┘
```

**Security Note**: Only encrypted mnemonic is stored. Private keys are never persisted - they're derived on-demand when wallet is unlocked.

---

### 2. Session Manager (`sessionManager.ts`)

**Purpose**: Automatically lock the wallet after a period of inactivity to protect against unattended access.

**Key Concepts**:
- **Auto-lock Timer**: Countdown that triggers wallet lock
- **Activity Tracking**: User interactions reset the countdown
- **Callback Pattern**: Lock function passed in, not hardcoded

```typescript
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;  // 5 minutes

let autoLockTimerId: ReturnType<typeof setTimeout> | null = null;
let onLockCallback: (() => void) | null = null;
let currentTimeoutMs: number = DEFAULT_TIMEOUT_MS;

function createTimer(): void {
  autoLockTimerId = setTimeout(() => {
    if (onLockCallback) {
      onLockCallback();
    }
  }, currentTimeoutMs);
}

export function startAutoLock(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  onLock: () => void
): void {
  stopAutoLock();  // Clear any existing timer
  currentTimeoutMs = timeoutMs;
  onLockCallback = onLock;
  createTimer();
}

export function resetActivity(): void {
  if (autoLockTimerId === null || onLockCallback === null) {
    return;  // No active timer
  }
  clearTimeout(autoLockTimerId);
  createTimer();  // Restart countdown
}

export function stopAutoLock(): void {
  if (autoLockTimerId !== null) {
    clearTimeout(autoLockTimerId);
    autoLockTimerId = null;
  }
  onLockCallback = null;
}
```

**Usage Pattern**:
```typescript
// When wallet unlocks
startAutoLock(5 * 60 * 1000, lockWallet);

// On user interaction (click, keypress, etc.)
document.addEventListener('click', resetActivity);
document.addEventListener('keypress', resetActivity);

// When wallet locks
stopAutoLock();
```

**Flow Diagram**:
```
Wallet Unlocks
      │
      ▼
┌─────────────────┐
│ Start 5min Timer│
└────────┬────────┘
         │
         ▼
   ┌──────────┐     User Activity
   │  Waiting │ ◄─────────────────┐
   └────┬─────┘                   │
        │                         │
        ▼                         │
   Timer Tick                     │
        │                         │
   ┌────┴────┐                    │
   │ Expired?│─── No ─────────────┘
   └────┬────┘
        │ Yes
        ▼
┌─────────────────┐
│  Lock Wallet    │
│  (clear memory) │
└─────────────────┘
```

---

### 3. Wallet Service (`walletService.ts`)

**Purpose**: Central orchestrator that coordinates all wallet operations across crypto, storage, and state layers.

**In-Memory Sensitive Data**:
```typescript
// Held ONLY while wallet is unlocked
let decryptedMnemonic: string | null = null;
let derivedSeed: Uint8Array | null = null;
```

**Wallet Creation Flow**:
```typescript
export async function createWallet(
  name: string,
  password: string
): Promise<{ id: string; mnemonic: string }> {
  // 1. Generate new BIP39 mnemonic
  const mnemonic = generateMnemonic();

  // 2. Derive seed and addresses for all chains
  const seed = mnemonicToSeed(mnemonic);
  const ethAddress = deriveEthereumAddress(seed);
  const btcAddress = deriveBitcoinAddress(seed);
  const solAddress = deriveSolanaAddress(seed);

  // 3. Encrypt mnemonic with user's password
  const encryptedData = await encrypt(mnemonic, password);

  // 4. Save to IndexedDB
  const walletId = crypto.randomUUID();
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

  // 5. Update Zustand store
  const { actions } = useWalletStore.getState();
  actions.setWallet({
    id: walletId,
    name,
    isLocked: true,  // New wallet starts locked
    accounts: [],
    createdAt: new Date(storedWallet.createdAt).toISOString(),
  });

  // 6. Clean up seed (mnemonic returned for user backup)
  zeroBuffer(seed);

  return { id: walletId, mnemonic };
}
```

**Unlock/Lock Flow**:
```typescript
export async function unlockWallet(
  walletId: string,
  password: string
): Promise<void> {
  // 1. Get encrypted wallet from IndexedDB
  const storedWallet = await getWallet(walletId);
  if (!storedWallet) throw new Error("Wallet not found");

  // 2. Decrypt mnemonic (throws if password wrong)
  try {
    decryptedMnemonic = await decrypt(storedWallet.encryptedMnemonic, password);
  } catch {
    throw new Error("Incorrect password");
  }

  // 3. Derive seed for signing operations
  derivedSeed = mnemonicToSeed(decryptedMnemonic);

  // 4. Start auto-lock timer
  startAutoLock(AUTO_LOCK_TIMEOUT_MS, lockWallet);

  // 5. Update state
  const { actions } = useWalletStore.getState();
  actions.setWallet({ ...wallet, isLocked: false });
  actions.unlockWallet();
}

export function lockWallet(): void {
  // Clear sensitive data
  if (derivedSeed) {
    zeroBuffer(derivedSeed);
    derivedSeed = null;
  }
  decryptedMnemonic = null;

  // Stop timer
  stopAutoLock();

  // Update state
  useWalletStore.getState().actions.lockWallet();
}
```

**Complete Data Flow**:
```
┌─────────────────────────────────────────────────────────────────┐
│                        CREATE WALLET                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Input: name, password                                      │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │ Generate    │────▶│ Derive      │────▶│ Encrypt     │        │
│  │ Mnemonic    │     │ Addresses   │     │ Mnemonic    │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                 │                │
│       ┌─────────────────────────────────────────┘                │
│       ▼                                                          │
│  ┌─────────────┐     ┌─────────────┐                            │
│  │ Save to     │────▶│ Update      │                            │
│  │ IndexedDB   │     │ Zustand     │                            │
│  └─────────────┘     └─────────────┘                            │
│                                                                  │
│  Output: { id, mnemonic } ─── User must backup mnemonic!        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        UNLOCK WALLET                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Input: walletId, password                                  │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │ Get from    │────▶│ Decrypt     │────▶│ Derive      │        │
│  │ IndexedDB   │     │ Mnemonic    │     │ Seed        │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                 │                │
│       ┌─────────────────────────────────────────┘                │
│       ▼                                                          │
│  ┌─────────────┐     ┌─────────────┐                            │
│  │ Start       │────▶│ Update      │                            │
│  │ Auto-Lock   │     │ State       │                            │
│  └─────────────┘     └─────────────┘                            │
│                                                                  │
│  In Memory: decryptedMnemonic, derivedSeed (for signing)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         LOCK WALLET                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Triggered by: Manual lock OR Auto-lock timeout                  │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │ Zero        │────▶│ Stop        │────▶│ Update      │        │
│  │ Memory      │     │ Timer       │     │ State       │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                                  │
│  In Memory: null (sensitive data cleared)                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Created/Modified

### New Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/storage/indexedDB.ts` | ~100 | IndexedDB CRUD operations |
| `src/lib/storage/sessionManager.ts` | 111 | Auto-lock timer management |
| `src/lib/storage/walletService.ts` | 306 | Central wallet orchestrator |
| `src/lib/storage/__tests__/indexedDB.test.ts` | 305 | 15 IndexedDB tests |
| `src/lib/storage/__tests__/sessionManager.test.ts` | 191 | 21 session manager tests |
| `src/lib/storage/__tests__/walletService.test.ts` | 296 | 34 wallet service tests |

### Dependencies Used

```json
{
  "fake-indexeddb": "^6.0.0"  // For testing IndexedDB in Node.js
}
```

---

## Testing

### Run Tests

```bash
cd frontend

# Run storage tests only
npm test -- --run src/lib/storage/__tests__/

# Run all tests
npm run test:run
```

### Test Results

```
 ✓ src/lib/storage/__tests__/sessionManager.test.ts (21 tests)
 ✓ src/lib/storage/__tests__/indexedDB.test.ts (15 tests)
 ✓ src/lib/storage/__tests__/walletService.test.ts (34 tests)

 Test Files  3 passed (3)
 Tests       70 passed (70)
```

### Test Coverage by Component

**indexedDB.ts**:
- Save/retrieve wallets
- Update existing wallets (upsert)
- Delete wallets
- Preserve Uint8Array data correctly
- Handle non-existent wallets

**sessionManager.ts**:
- Start/stop auto-lock timer
- Reset timer on activity
- Execute callback on timeout
- Handle edge cases (no timer, multiple resets)

**walletService.ts**:
- Create wallet (with mocked crypto)
- Import wallet (validate mnemonic)
- Unlock/lock wallet
- Delete wallet
- State synchronization with Zustand

---

## Security Considerations

### What We Implemented

1. **Encrypted Storage**: Mnemonics encrypted with Argon2 + AES-256-GCM (from Task 1)
2. **Auto-Lock**: 5-minute inactivity timeout clears sensitive data
3. **Memory Cleanup**: `zeroBuffer()` called on sensitive data after use
4. **No Private Key Storage**: Keys derived on-demand, never persisted

### Security Model

```
┌────────────────────────────────────────────────────────────────┐
│                    WALLET LOCKED (Default)                      │
├────────────────────────────────────────────────────────────────┤
│  IndexedDB:                                                     │
│    - id, name, createdAt       (metadata - not sensitive)      │
│    - encryptedMnemonic         (AES-256-GCM encrypted)         │
│    - addresses                 (public - not sensitive)         │
│                                                                 │
│  Memory:                                                        │
│    - decryptedMnemonic = null                                   │
│    - derivedSeed = null                                         │
│                                                                 │
│  Risk: LOW - only encrypted data accessible                     │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼ User enters password
┌────────────────────────────────────────────────────────────────┐
│                    WALLET UNLOCKED (Temporary)                  │
├────────────────────────────────────────────────────────────────┤
│  IndexedDB: (same as above)                                     │
│                                                                 │
│  Memory:                                                        │
│    - decryptedMnemonic = "word1 word2 ..."  (SENSITIVE!)       │
│    - derivedSeed = Uint8Array(64)           (SENSITIVE!)       │
│                                                                 │
│  Auto-Lock Timer: Active (5 minutes)                            │
│                                                                 │
│  Risk: MEDIUM - sensitive data in memory                        │
│  Mitigation: Auto-lock, activity tracking                       │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Timeout or manual lock
┌────────────────────────────────────────────────────────────────┐
│                    WALLET LOCKED (After Use)                    │
├────────────────────────────────────────────────────────────────┤
│  Memory:                                                        │
│    - zeroBuffer(derivedSeed) called                            │
│    - decryptedMnemonic = null                                   │
│    - derivedSeed = null                                         │
│                                                                 │
│  Risk: LOW - sensitive data cleared                             │
└────────────────────────────────────────────────────────────────┘
```

### Remaining Risks (Browser Limitations)

1. **Garbage Collection**: JavaScript doesn't guarantee immediate memory release
2. **Browser Extensions**: Malicious extensions can access page memory
3. **Dev Tools**: Open console can inspect variables
4. **No Secure Enclave**: Unlike native apps, no hardware-backed storage

---

## Integration with Zustand Store

The wallet service updates the Zustand store (`walletStore.ts`) to keep UI in sync:

```typescript
// State structure
interface WalletState {
  currentWallet: Wallet | null;  // Current wallet metadata
  isUnlocked: boolean;           // Lock state
  // ... other state
}

// Actions used by walletService
actions.setWallet(wallet)   // Set current wallet
actions.lockWallet()        // Set isUnlocked = false
actions.unlockWallet()      // Set isUnlocked = true
actions.clearWallet()       // Reset all wallet state
```

**Type Mapping** (StoredWallet → Wallet):
```typescript
// IndexedDB stores:
StoredWallet {
  createdAt: number;  // Unix timestamp
  // no isLocked (always encrypted at rest)
}

// Zustand expects:
Wallet {
  createdAt: string;  // ISO string
  isLocked: boolean;  // Runtime state
}

// Conversion in walletService:
actions.setWallet({
  ...storedWallet,
  isLocked: true,
  createdAt: new Date(storedWallet.createdAt).toISOString(),
});
```

---

## Next Steps

### Immediate (Task 3+)
- [ ] UI components for wallet creation flow
- [ ] Activity listener integration (`resetActivity` on user events)
- [ ] Mnemonic backup/display UI
- [ ] Settings for auto-lock timeout customization

### Future
- [ ] Transaction signing using derived keys
- [ ] Multi-wallet management UI
- [ ] Export/backup functionality
- [ ] Hardware wallet integration

---

## References

- [IndexedDB API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- Task 1: P1-W2-FE-T1-Implementation-Log.md (Cryptographic Functionality)
