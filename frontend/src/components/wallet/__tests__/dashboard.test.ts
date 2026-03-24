import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Dashboard component logic tests
 *
 * Since the test environment is node (not jsdom/happy-dom), we test
 * the pure logic functions rather than rendering React components.
 * Component rendering would require a browser-like environment.
 */

// Test the buildAccountsFromAddresses logic by importing walletService
// and verifying unlockWallet populates accounts correctly.
// We mock the crypto and storage layers to isolate the logic.

vi.mock('@/lib/crypto/mnemonic', () => ({
  generateMnemonic: vi.fn(() => 'test mnemonic'),
  validateMnemonic: vi.fn(() => true),
  mnemonicToSeed: vi.fn(() => new Uint8Array(64)),
}));

vi.mock('@/lib/crypto/encryption', () => ({
  encrypt: vi.fn(async () => ({
    ciphertext: new Uint8Array([1]),
    salt: new Uint8Array([2]),
    nonce: new Uint8Array([3]),
  })),
  decrypt: vi.fn(async () => 'test mnemonic'),
}));

vi.mock('@/lib/crypto/hdwallet', () => ({
  deriveEthereumAddress: vi.fn(() => ({ address: '0xEthAddress' })),
  deriveBitcoinAddress: vi.fn(() => ({ address: '1BtcAddress' })),
  deriveSolanaAddress: vi.fn(() => ({ address: 'SolAddress' })),
}));

vi.mock('@/lib/crypto/secureMemory', () => ({
  zeroBuffer: vi.fn(),
}));

vi.mock('@/lib/storage/sessionManager', () => ({
  startAutoLock: vi.fn(),
  stopAutoLock: vi.fn(),
  resetActivity: vi.fn(),
}));

// Mock IndexedDB
const mockWallets = new Map<string, any>();

vi.mock('@/lib/storage/indexedDB', () => ({
  saveWallet: vi.fn(async (wallet: any) => {
    mockWallets.set(wallet.id, wallet);
  }),
  getWallet: vi.fn(async (id: string) => mockWallets.get(id)),
  getAllWallets: vi.fn(async () => Array.from(mockWallets.values())),
  deleteWallet: vi.fn(async (id: string) => {
    mockWallets.delete(id);
  }),
}));

// Import after mocks are set up
import {
  createWallet,
  unlockWallet,
  lockWallet,
  loadWallets,
  deleteWalletById,
} from '@/lib/storage/walletService';
import { useWalletStore } from '@/lib/stores/walletStore';

beforeEach(() => {
  mockWallets.clear();
  useWalletStore.getState().actions.clearWallet();
});

describe('buildAccountsFromAddresses (via unlockWallet)', () => {
  it('populates accounts with all 3 chains after unlock', async () => {
    const { id } = await createWallet('Test Wallet', 'password123');

    await unlockWallet(id, 'password123');

    const state = useWalletStore.getState();
    expect(state.isUnlocked).toBe(true);
    expect(state.currentWallet).not.toBeNull();
    expect(state.currentWallet!.accounts).toHaveLength(3);

    const ethAccount = state.currentWallet!.accounts.find((a) => a.chain === 'Ethereum');
    expect(ethAccount).toBeDefined();
    expect(ethAccount!.address).toBe('0xEthAddress');
    expect(ethAccount!.derivationPath).toBe("m/44'/60'/0'/0/0");
    expect(ethAccount!.accountIndex).toBe(0);

    const btcAccount = state.currentWallet!.accounts.find((a) => a.chain === 'Bitcoin');
    expect(btcAccount).toBeDefined();
    expect(btcAccount!.address).toBe('1BtcAddress');
    expect(btcAccount!.derivationPath).toBe("m/44'/0'/0'/0/0");

    const solAccount = state.currentWallet!.accounts.find((a) => a.chain === 'Solana');
    expect(solAccount).toBeDefined();
    expect(solAccount!.address).toBe('SolAddress');
    expect(solAccount!.derivationPath).toBe("m/44'/501'/0'/0'");
  });

  it('sets wallet name and unlocked state correctly', async () => {
    const { id } = await createWallet('My Wallet', 'password123');
    await unlockWallet(id, 'password123');

    const state = useWalletStore.getState();
    expect(state.currentWallet!.name).toBe('My Wallet');
    expect(state.currentWallet!.isLocked).toBe(false);
    expect(state.isUnlocked).toBe(true);
  });

  it('handles wallet with partial addresses', async () => {
    // Manually create a wallet with only ethereum address
    const walletId = 'partial-wallet';
    mockWallets.set(walletId, {
      id: walletId,
      name: 'Partial Wallet',
      encryptedMnemonic: {
        ciphertext: new Uint8Array([1]),
        salt: new Uint8Array([2]),
        nonce: new Uint8Array([3]),
      },
      createdAt: Date.now(),
      addresses: {
        ethereum: '0xOnlyEth',
      },
    });

    await unlockWallet(walletId, 'password123');

    const state = useWalletStore.getState();
    expect(state.currentWallet!.accounts).toHaveLength(1);
    expect(state.currentWallet!.accounts[0].chain).toBe('Ethereum');
    expect(state.currentWallet!.accounts[0].address).toBe('0xOnlyEth');
  });
});

describe('lockWallet', () => {
  it('clears accounts and sets locked state', async () => {
    const { id } = await createWallet('Test', 'password123');
    await unlockWallet(id, 'password123');

    expect(useWalletStore.getState().isUnlocked).toBe(true);

    lockWallet();

    const state = useWalletStore.getState();
    expect(state.isUnlocked).toBe(false);
  });
});

describe('loadWallets', () => {
  it('returns all stored wallets', async () => {
    await createWallet('Wallet 1', 'password123');
    await createWallet('Wallet 2', 'password456');

    const wallets = await loadWallets();
    expect(wallets).toHaveLength(2);
  });

  it('returns empty array when no wallets exist', async () => {
    const wallets = await loadWallets();
    expect(wallets).toHaveLength(0);
  });
});

describe('deleteWalletById', () => {
  it('removes wallet from storage', async () => {
    const { id } = await createWallet('To Delete', 'password123');

    let wallets = await loadWallets();
    expect(wallets).toHaveLength(1);

    await deleteWalletById(id);

    wallets = await loadWallets();
    expect(wallets).toHaveLength(0);
  });

  it('locks wallet if currently unlocked before deleting', async () => {
    const { id } = await createWallet('Active Wallet', 'password123');
    await unlockWallet(id, 'password123');

    expect(useWalletStore.getState().isUnlocked).toBe(true);

    await deleteWalletById(id);

    expect(useWalletStore.getState().isUnlocked).toBe(false);
    expect(useWalletStore.getState().currentWallet).toBeNull();
  });
});
