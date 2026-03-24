/**
 * Balance Service — Fetches and populates account balances
 *
 * Calls the backend balance endpoint for a wallet, then populates the
 * Zustand store. Falls back to client-side mock balances when the
 * backend is unreachable so the UI still renders.
 *
 * All balance data is public information — no security boundary concerns.
 */

import { getBalance } from '@/lib/api/wallets';
import type { AddressBalance } from '@/lib/api/types';
import type { Account, Balance, Chain } from '@/lib/types/wallet';
import { useWalletStore } from '@/lib/stores/walletStore';

// ============================================================================
// Chain symbol mapping
// ============================================================================

const CHAIN_SYMBOLS: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  Bitcoin: 'BTC',
  Ethereum: 'ETH',
  Solana: 'SOL',
};

const CHAIN_DISPLAY_DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 4,
  SOL: 4,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch balances for all accounts in a wallet and populate the store.
 *
 * Tries the backend first. On failure, falls back to zero mock balances
 * so the UI always has something to display.
 */
export async function fetchBalancesForWallet(
  walletId: string,
  accounts: Account[]
): Promise<void> {
  const { setBalance } = useWalletStore.getState().actions;

  const result = await getBalance(walletId);

  if (result.success && result.data?.balances?.length) {
    // Map API balances to accounts by matching address
    for (const account of accounts) {
      const apiBalance = result.data.balances.find(
        (b) => b.address.toLowerCase() === account.address.toLowerCase()
      );
      if (apiBalance) {
        setBalance(account.id, mapApiBalance(apiBalance, account.id));
      } else {
        setBalance(account.id, getMockBalance(account));
      }
    }
  } else {
    // Backend unavailable — populate with mock zeros
    for (const account of accounts) {
      setBalance(account.id, getMockBalance(account));
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert an API AddressBalance to the Zustand Balance type.
 */
export function mapApiBalance(
  apiBalance: AddressBalance,
  accountId: string
): Balance {
  const symbol = CHAIN_SYMBOLS[apiBalance.chain] ?? apiBalance.symbol;
  const decimals = CHAIN_DISPLAY_DECIMALS[symbol] ?? 4;
  const numericBalance = parseFloat(apiBalance.balance) || 0;

  return {
    accountId,
    chain: normalizeChain(apiBalance.chain),
    nativeBalance: apiBalance.balance,
    formattedBalance: `${numericBalance.toFixed(decimals)} ${symbol}`,
    lastUpdated: apiBalance.timestamp,
  };
}

/**
 * Generate a zero-balance entry for an account (fallback when API is unavailable).
 */
export function getMockBalance(account: Account): Balance {
  const symbol = CHAIN_SYMBOLS[account.chain] ?? account.chain;
  const decimals = CHAIN_DISPLAY_DECIMALS[symbol] ?? 4;

  return {
    accountId: account.id,
    chain: account.chain,
    nativeBalance: '0',
    formattedBalance: `${(0).toFixed(decimals)} ${symbol}`,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Normalize chain string from API (lowercase) to our Chain type (PascalCase).
 */
function normalizeChain(chain: string): Chain {
  const map: Record<string, Chain> = {
    bitcoin: 'Bitcoin',
    ethereum: 'Ethereum',
    solana: 'Solana',
  };
  return map[chain.toLowerCase()] ?? (chain as Chain);
}

/**
 * Format a balance string for display with appropriate precision.
 */
export function formatBalance(balance: string, chain: Chain): string {
  const symbol = CHAIN_SYMBOLS[chain] ?? chain;
  const decimals = CHAIN_DISPLAY_DECIMALS[symbol] ?? 4;
  const numericBalance = parseFloat(balance) || 0;
  return `${numericBalance.toFixed(decimals)} ${symbol}`;
}
