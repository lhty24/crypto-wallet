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
import { getEthBalance } from '@/lib/rpc/ethereum';
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

  const ethAccounts = accounts.filter((a) => a.chain === 'Ethereum');
  const otherAccounts = accounts.filter((a) => a.chain !== 'Ethereum');

  // Ethereum: direct RPC via Viem
  await Promise.all(
    ethAccounts.map(async (account) => {
      const rpcBalance = await getEthBalance(account.address);
      if (rpcBalance) {
        setBalance(account.id, {
          accountId: account.id,
          chain: 'Ethereum',
          nativeBalance: rpcBalance.formatted,
          formattedBalance: formatBalance(rpcBalance.formatted, 'Ethereum'),
          lastUpdated: new Date().toISOString(),
        });
      } else {
        setBalance(account.id, getMockBalance(account));
      }
    })
  );

  // Other chains: backend API (still mock for Bitcoin/Solana)
  if (otherAccounts.length > 0) {
    const result = await getBalance(walletId);
    for (const account of otherAccounts) {
      if (result.success && result.data?.balances?.length) {
        const apiBalance = result.data.balances.find(
          (b) => b.address.toLowerCase() === account.address.toLowerCase()
        );
        setBalance(
          account.id,
          apiBalance
            ? mapApiBalance(apiBalance, account.id)
            : getMockBalance(account)
        );
      } else {
        setBalance(account.id, getMockBalance(account));
      }
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
