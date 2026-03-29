import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

const mockGetBalance = vi.fn();
const mockGetEthBalance = vi.fn();

vi.mock('@/lib/api/wallets', () => ({
  getBalance: (...args: unknown[]) => mockGetBalance(...args),
}));

vi.mock('@/lib/rpc/ethereum', () => ({
  getEthBalance: (...args: unknown[]) => mockGetEthBalance(...args),
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
  mockGetEthBalance.mockReset();
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
  it('uses RPC for Ethereum accounts and API for others', async () => {
    mockGetEthBalance.mockResolvedValue({
      balance: '1500000000000000000',
      formatted: '1.5',
    });
    mockGetBalance.mockResolvedValue({
      success: true,
      data: {
        wallet_id: 'w1',
        balances: [apiBalances[1], apiBalances[2]], // BTC, SOL
      },
    });

    await fetchBalancesForWallet('w1', allAccounts);

    const state = useWalletStore.getState();
    // ETH via RPC
    expect(state.balances['eth-1']).toBeDefined();
    expect(state.balances['eth-1'].nativeBalance).toBe('1.5');
    expect(state.balances['eth-1'].chain).toBe('Ethereum');
    // BTC via backend API
    expect(state.balances['btc-1']).toBeDefined();
    expect(state.balances['btc-1'].nativeBalance).toBe('0.001');
    // SOL via backend API
    expect(state.balances['sol-1']).toBeDefined();
    expect(state.balances['sol-1'].nativeBalance).toBe('10.0');
  });

  it('falls back to mock when RPC fails for Ethereum', async () => {
    mockGetEthBalance.mockResolvedValue(null);
    mockGetBalance.mockResolvedValue({ success: false, error: 'fail' });

    await fetchBalancesForWallet('w1', allAccounts);

    const state = useWalletStore.getState();
    expect(state.balances['eth-1'].nativeBalance).toBe('0');
    expect(state.balances['eth-1'].formattedBalance).toBe('0.0000 ETH');
  });

  it('falls back to mock when API fails for non-Ethereum', async () => {
    mockGetEthBalance.mockResolvedValue({ balance: '0', formatted: '0' });
    mockGetBalance.mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    await fetchBalancesForWallet('w1', allAccounts);

    const state = useWalletStore.getState();
    expect(state.balances['btc-1'].nativeBalance).toBe('0');
    expect(state.balances['sol-1'].nativeBalance).toBe('0');
  });

  it('does not call backend API when only Ethereum accounts exist', async () => {
    mockGetEthBalance.mockResolvedValue({ balance: '0', formatted: '0' });

    await fetchBalancesForWallet('w1', [ethAccount]);

    expect(mockGetBalance).not.toHaveBeenCalled();
  });

  it('does not call RPC when no Ethereum accounts exist', async () => {
    mockGetBalance.mockResolvedValue({
      success: true,
      data: { wallet_id: 'w1', balances: [apiBalances[1], apiBalances[2]] },
    });

    await fetchBalancesForWallet('w1', [btcAccount, solAccount]);

    expect(mockGetEthBalance).not.toHaveBeenCalled();
  });

  it('uses mock for non-Ethereum accounts not found in API response', async () => {
    mockGetEthBalance.mockResolvedValue({ balance: '0', formatted: '0' });
    mockGetBalance.mockResolvedValue({
      success: true,
      data: { wallet_id: 'w1', balances: [] },
    });

    await fetchBalancesForWallet('w1', allAccounts);

    const state = useWalletStore.getState();
    expect(state.balances['btc-1'].nativeBalance).toBe('0');
    expect(state.balances['sol-1'].nativeBalance).toBe('0');
  });

  it('matches non-Ethereum addresses case-insensitively', async () => {
    mockGetEthBalance.mockResolvedValue({ balance: '0', formatted: '0' });
    const lowercaseBalances: AddressBalance[] = [{
      address: '1a1zp1ep5qgefi2dmptftl5slmv7divfna',
      chain: 'bitcoin',
      balance: '0.005',
      symbol: 'BTC',
      timestamp: '2026-03-24T00:00:00Z',
    }];
    mockGetBalance.mockResolvedValue({
      success: true,
      data: { wallet_id: 'w1', balances: lowercaseBalances },
    });

    await fetchBalancesForWallet('w1', [ethAccount, btcAccount]);

    const state = useWalletStore.getState();
    expect(state.balances['btc-1'].nativeBalance).toBe('0.005');
  });

  it('calls getBalance with the correct wallet ID for non-Ethereum accounts', async () => {
    mockGetEthBalance.mockResolvedValue({ balance: '0', formatted: '0' });
    mockGetBalance.mockResolvedValue({ success: false, error: 'fail' });

    await fetchBalancesForWallet('my-wallet-id', allAccounts);

    expect(mockGetBalance).toHaveBeenCalledWith('my-wallet-id');
  });
});
