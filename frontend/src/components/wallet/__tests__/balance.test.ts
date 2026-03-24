import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

const mockGetBalance = vi.fn();

vi.mock('@/lib/api/wallets', () => ({
  getBalance: (...args: unknown[]) => mockGetBalance(...args),
}));

// Import after mocks
import {
  fetchBalancesForWallet,
  mapApiBalance,
  getMockBalance,
  formatBalance,
} from '@/lib/storage/balanceService';
import { useWalletStore } from '@/lib/stores/walletStore';
import type { Account } from '@/lib/types/wallet';
import type { AddressBalance } from '@/lib/api/types';

// ============================================================================
// Test data
// ============================================================================

const ethAccount: Account = {
  id: 'eth-1',
  name: 'Ethereum 0',
  address: '0xABCDEF1234567890abcdef1234567890ABCDEF12',
  chain: 'Ethereum',
  derivationPath: "m/44'/60'/0'/0/0",
  accountIndex: 0,
};

const btcAccount: Account = {
  id: 'btc-1',
  name: 'Bitcoin 0',
  address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  chain: 'Bitcoin',
  derivationPath: "m/44'/0'/0'/0/0",
  accountIndex: 0,
};

const solAccount: Account = {
  id: 'sol-1',
  name: 'Solana 0',
  address: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
  chain: 'Solana',
  derivationPath: "m/44'/501'/0'/0'",
  accountIndex: 0,
};

const allAccounts = [ethAccount, btcAccount, solAccount];

const apiBalances: AddressBalance[] = [
  {
    address: '0xABCDEF1234567890abcdef1234567890ABCDEF12',
    chain: 'ethereum',
    balance: '1.5',
    symbol: 'ETH',
    timestamp: '2026-03-24T00:00:00Z',
  },
  {
    address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    chain: 'bitcoin',
    balance: '0.001',
    symbol: 'BTC',
    timestamp: '2026-03-24T00:00:00Z',
  },
  {
    address: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
    chain: 'solana',
    balance: '10.0',
    symbol: 'SOL',
    timestamp: '2026-03-24T00:00:00Z',
  },
];

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  mockGetBalance.mockReset();
  useWalletStore.getState().actions.clearWallet();
});

// ============================================================================
// mapApiBalance
// ============================================================================

describe('mapApiBalance', () => {
  it('converts API AddressBalance to store Balance', () => {
    const result = mapApiBalance(apiBalances[0], 'eth-1');

    expect(result.accountId).toBe('eth-1');
    expect(result.chain).toBe('Ethereum');
    expect(result.nativeBalance).toBe('1.5');
    expect(result.formattedBalance).toBe('1.5000 ETH');
    expect(result.lastUpdated).toBe('2026-03-24T00:00:00Z');
  });

  it('maps Bitcoin balance with 8 decimal places', () => {
    const result = mapApiBalance(apiBalances[1], 'btc-1');

    expect(result.chain).toBe('Bitcoin');
    expect(result.formattedBalance).toBe('0.00100000 BTC');
  });

  it('maps Solana balance with 4 decimal places', () => {
    const result = mapApiBalance(apiBalances[2], 'sol-1');

    expect(result.chain).toBe('Solana');
    expect(result.formattedBalance).toBe('10.0000 SOL');
  });

  it('handles zero balance', () => {
    const zero: AddressBalance = {
      address: '0xABC',
      chain: 'ethereum',
      balance: '0',
      symbol: 'ETH',
      timestamp: '2026-03-24T00:00:00Z',
    };
    const result = mapApiBalance(zero, 'eth-1');

    expect(result.nativeBalance).toBe('0');
    expect(result.formattedBalance).toBe('0.0000 ETH');
  });
});

// ============================================================================
// getMockBalance
// ============================================================================

describe('getMockBalance', () => {
  it('returns zero ETH balance for Ethereum account', () => {
    const result = getMockBalance(ethAccount);

    expect(result.accountId).toBe('eth-1');
    expect(result.chain).toBe('Ethereum');
    expect(result.nativeBalance).toBe('0');
    expect(result.formattedBalance).toBe('0.0000 ETH');
  });

  it('returns zero BTC balance with 8 decimals', () => {
    const result = getMockBalance(btcAccount);

    expect(result.formattedBalance).toBe('0.00000000 BTC');
  });

  it('returns zero SOL balance with 4 decimals', () => {
    const result = getMockBalance(solAccount);

    expect(result.formattedBalance).toBe('0.0000 SOL');
  });

  it('includes a timestamp', () => {
    const result = getMockBalance(ethAccount);
    expect(result.lastUpdated).toBeTruthy();
    // Should be a valid ISO string
    expect(() => new Date(result.lastUpdated)).not.toThrow();
  });
});

// ============================================================================
// formatBalance
// ============================================================================

describe('formatBalance', () => {
  it('formats ETH with 4 decimals', () => {
    expect(formatBalance('1.23456789', 'Ethereum')).toBe('1.2346 ETH');
  });

  it('formats BTC with 8 decimals', () => {
    expect(formatBalance('0.001', 'Bitcoin')).toBe('0.00100000 BTC');
  });

  it('formats SOL with 4 decimals', () => {
    expect(formatBalance('10', 'Solana')).toBe('10.0000 SOL');
  });

  it('handles invalid balance string', () => {
    expect(formatBalance('not-a-number', 'Ethereum')).toBe('0.0000 ETH');
  });
});

// ============================================================================
// fetchBalancesForWallet
// ============================================================================

describe('fetchBalancesForWallet', () => {
  it('populates store with API balances on success', async () => {
    mockGetBalance.mockResolvedValue({
      success: true,
      data: { wallet_id: 'w1', balances: apiBalances },
    });

    await fetchBalancesForWallet('w1', allAccounts);

    const state = useWalletStore.getState();
    expect(state.balances['eth-1']).toBeDefined();
    expect(state.balances['eth-1'].nativeBalance).toBe('1.5');
    expect(state.balances['eth-1'].formattedBalance).toBe('1.5000 ETH');

    expect(state.balances['btc-1']).toBeDefined();
    expect(state.balances['btc-1'].nativeBalance).toBe('0.001');

    expect(state.balances['sol-1']).toBeDefined();
    expect(state.balances['sol-1'].nativeBalance).toBe('10.0');
  });

  it('falls back to mock balances when API fails', async () => {
    mockGetBalance.mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    await fetchBalancesForWallet('w1', allAccounts);

    const state = useWalletStore.getState();
    expect(state.balances['eth-1']).toBeDefined();
    expect(state.balances['eth-1'].nativeBalance).toBe('0');
    expect(state.balances['eth-1'].formattedBalance).toBe('0.0000 ETH');

    expect(state.balances['btc-1'].nativeBalance).toBe('0');
    expect(state.balances['sol-1'].nativeBalance).toBe('0');
  });

  it('uses mock balance for accounts not found in API response', async () => {
    // API only returns ETH balance, missing BTC and SOL
    mockGetBalance.mockResolvedValue({
      success: true,
      data: { wallet_id: 'w1', balances: [apiBalances[0]] },
    });

    await fetchBalancesForWallet('w1', allAccounts);

    const state = useWalletStore.getState();
    // ETH should have API data
    expect(state.balances['eth-1'].nativeBalance).toBe('1.5');
    // BTC and SOL should fall back to mock
    expect(state.balances['btc-1'].nativeBalance).toBe('0');
    expect(state.balances['sol-1'].nativeBalance).toBe('0');
  });

  it('handles empty balances array from API', async () => {
    mockGetBalance.mockResolvedValue({
      success: true,
      data: { wallet_id: 'w1', balances: [] },
    });

    await fetchBalancesForWallet('w1', allAccounts);

    const state = useWalletStore.getState();
    // All should fall back to mock
    expect(state.balances['eth-1'].nativeBalance).toBe('0');
    expect(state.balances['btc-1'].nativeBalance).toBe('0');
    expect(state.balances['sol-1'].nativeBalance).toBe('0');
  });

  it('matches addresses case-insensitively', async () => {
    const lowercaseBalances: AddressBalance[] = [{
      address: '0xabcdef1234567890abcdef1234567890abcdef12', // all lowercase
      chain: 'ethereum',
      balance: '2.0',
      symbol: 'ETH',
      timestamp: '2026-03-24T00:00:00Z',
    }];

    mockGetBalance.mockResolvedValue({
      success: true,
      data: { wallet_id: 'w1', balances: lowercaseBalances },
    });

    await fetchBalancesForWallet('w1', [ethAccount]);

    const state = useWalletStore.getState();
    expect(state.balances['eth-1'].nativeBalance).toBe('2.0');
  });

  it('calls getBalance with the correct wallet ID', async () => {
    mockGetBalance.mockResolvedValue({ success: false, error: 'fail' });

    await fetchBalancesForWallet('my-wallet-id', []);

    expect(mockGetBalance).toHaveBeenCalledWith('my-wallet-id');
  });
});
