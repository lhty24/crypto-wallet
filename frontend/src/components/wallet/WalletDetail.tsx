'use client';

import { useEffect, useState } from 'react';
import { useWallet, useIsUnlocked, useWalletStore } from '@/lib/stores/walletStore';
import { lockWallet } from '@/lib/storage/walletService';
import { fetchBalancesForWallet } from '@/lib/storage/balanceService';
import AccountCard from './AccountCard';

interface WalletDetailProps {
  onLocked: () => void;
}

export default function WalletDetail({ onLocked }: WalletDetailProps) {
  const wallet = useWallet();
  const isUnlocked = useIsUnlocked();
  const balances = useWalletStore((state) => state.balances);
  const [balanceLoading, setBalanceLoading] = useState(true);

  useEffect(() => {
    if (!wallet || !isUnlocked) return;

    let cancelled = false;
    setBalanceLoading(true);

    fetchBalancesForWallet(wallet.id, wallet.accounts).finally(() => {
      if (!cancelled) setBalanceLoading(false);
    });

    return () => { cancelled = true; };
  }, [wallet, isUnlocked]);

  const handleLock = () => {
    lockWallet();
    onLocked();
  };

  if (!wallet || !isUnlocked) {
    return null;
  }

  // Compute total balance summary per chain
  const totalByChain: Record<string, number> = {};
  for (const account of wallet.accounts) {
    const bal = balances[account.id];
    if (bal) {
      const value = parseFloat(bal.nativeBalance) || 0;
      totalByChain[bal.chain] = (totalByChain[bal.chain] || 0) + value;
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{wallet.name}</h2>
          <div className="flex items-center space-x-2 mt-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Unlocked</span>
          </div>
        </div>
        <button
          onClick={handleLock}
          className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
                     text-gray-900 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Lock Wallet
        </button>
      </div>

      {/* Portfolio Balance Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-5 text-white">
        <p className="text-sm font-medium text-blue-200 mb-2">Portfolio Balance</p>
        {balanceLoading ? (
          <p className="text-lg font-semibold">Loading balances...</p>
        ) : Object.keys(totalByChain).length > 0 ? (
          <div className="space-y-1">
            {Object.entries(totalByChain).map(([chain, total]) => (
              <p key={chain} className="text-lg font-semibold">
                {total.toFixed(chain === 'Bitcoin' ? 8 : 4)} {chain === 'Bitcoin' ? 'BTC' : chain === 'Ethereum' ? 'ETH' : 'SOL'}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-lg font-semibold">No balances available</p>
        )}
        <p className="text-xs text-blue-300 mt-2">Mock data — real balances coming in Phase 2</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Accounts</h3>
        {wallet.accounts.map((account) => {
          const bal = balances[account.id];
          return (
            <AccountCard
              key={account.id}
              chain={account.chain}
              address={account.address}
              derivationPath={account.derivationPath}
              formattedBalance={balanceLoading ? undefined : bal?.formattedBalance}
            />
          );
        })}
      </div>
    </div>
  );
}
